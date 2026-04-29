"""
Generador de archivos IFC — Motor de generación de modelos BIM.

Genera archivos IFC (Industry Foundation Classes) a partir de los datos
del modelo geotécnico. Crea:
  - Estratos de suelo como IfcSlab con propiedades geotécnicas
  - Cimentación como IfcFooting + IfcColumn
  - Nivel freático como plano de referencia

El archivo resultante es compatible con Revit, ArchiCAD, BIM Vision,
BlenderBIM y cualquier software que soporte IFC2X3/IFC4.

Dependencia: ifcopenshell
"""

import tempfile
import uuid
import time
import math
from pathlib import Path

import ifcopenshell
import ifcopenshell.guid


# ── Colores de estratos (RGB 0-1) ──
STRATA_COLORS = [
    (0.545, 0.451, 0.333),  # #8B7355
    (0.627, 0.322, 0.176),  # #A0522D
    (0.804, 0.522, 0.247),  # #CD853F
    (0.420, 0.259, 0.149),  # #6B4226
    (0.824, 0.706, 0.549),  # #D2B48C
    (0.545, 0.412, 0.078),  # #8B6914
    (0.737, 0.561, 0.561),  # #BC8F8F
    (0.647, 0.165, 0.165),  # #A52A2A
]

FOUNDATION_COLOR = (0.498, 0.549, 0.553)  # #7f8c8d gris concreto
WATER_COLOR = (0.204, 0.596, 0.859)       # #3498db azul


def _create_owner_history(ifc_file):
    """Crea el OwnerHistory requerido por IFC."""
    person = ifc_file.createIfcPerson(
        None, "CimentAviones", "User", None, None, None, None, None
    )
    org = ifc_file.createIfcOrganization(
        None, "CimentAviones", "Ingeniería de Cimentaciones", None, None
    )
    person_org = ifc_file.createIfcPersonAndOrganization(person, org, None)
    app = ifc_file.createIfcApplication(
        org, "1.0", "CimentAviones Web", "CimentAviones"
    )
    return ifc_file.createIfcOwnerHistory(
        person_org, app, None, "NOCHANGE", None, None, None,
        int(time.time())
    )


def _create_direction(ifc_file, coords):
    """Crea un IfcDirection."""
    return ifc_file.createIfcDirection([float(c) for c in coords])


def _create_point(ifc_file, coords):
    """Crea un IfcCartesianPoint."""
    return ifc_file.createIfcCartesianPoint([float(c) for c in coords])


def _create_axis2placement3d(ifc_file, origin=(0.0, 0.0, 0.0)):
    """Crea un Axis2Placement3D en la posición indicada."""
    point = _create_point(ifc_file, origin)
    z_dir = _create_direction(ifc_file, (0.0, 0.0, 1.0))
    x_dir = _create_direction(ifc_file, (1.0, 0.0, 0.0))
    return ifc_file.createIfcAxis2Placement3D(point, z_dir, x_dir)


def _create_local_placement(ifc_file, relative_to=None, origin=(0.0, 0.0, 0.0)):
    """Crea un IfcLocalPlacement."""
    placement = _create_axis2placement3d(ifc_file, origin)
    return ifc_file.createIfcLocalPlacement(relative_to, placement)


def _create_box_shape(ifc_file, context, width, depth, height):
    """
    Crea una representación de caja (extrusión rectangular).

    Args:
        width: Dimensión en X (B)
        depth: Dimensión en Y (L)
        height: Dimensión en Z (espesor/altura)
    """
    # Perfil rectangular centrado
    point = _create_point(ifc_file, (0.0, 0.0))
    x_dir = ifc_file.createIfcDirection([1.0, 0.0])
    placement_2d = ifc_file.createIfcAxis2Placement2D(point, x_dir)

    profile = ifc_file.createIfcRectangleProfileDef(
        "AREA", None, placement_2d, width, depth
    )

    # Extrusión en Z
    extrusion_dir = _create_direction(ifc_file, (0.0, 0.0, 1.0))
    solid = ifc_file.createIfcExtrudedAreaSolid(
        profile,
        _create_axis2placement3d(ifc_file, (0.0, 0.0, 0.0)),
        extrusion_dir,
        height,
    )

    shape_rep = ifc_file.createIfcShapeRepresentation(
        context, "Body", "SweptSolid", [solid]
    )
    return ifc_file.createIfcProductDefinitionShape(None, None, [shape_rep])


def _create_cylinder_shape(ifc_file, context, radius, height):
    """Crea una representación cilíndrica (para cimentación circular)."""
    point = _create_point(ifc_file, (0.0, 0.0))
    x_dir = ifc_file.createIfcDirection([1.0, 0.0])
    placement_2d = ifc_file.createIfcAxis2Placement2D(point, x_dir)

    profile = ifc_file.createIfcCircleProfileDef(
        "AREA", None, placement_2d, radius
    )

    extrusion_dir = _create_direction(ifc_file, (0.0, 0.0, 1.0))
    solid = ifc_file.createIfcExtrudedAreaSolid(
        profile,
        _create_axis2placement3d(ifc_file, (0.0, 0.0, 0.0)),
        extrusion_dir,
        height,
    )

    shape_rep = ifc_file.createIfcShapeRepresentation(
        context, "Body", "SweptSolid", [solid]
    )
    return ifc_file.createIfcProductDefinitionShape(None, None, [shape_rep])


def _assign_color(ifc_file, product, context, rgb):
    """Asigna un color a un producto IFC."""
    r, g, b = rgb
    colour = ifc_file.createIfcColourRgb(None, r, g, b)
    rendering = ifc_file.createIfcSurfaceStyleRendering(
        colour, 0.0, None, None, None, None, None, None, "FLAT"
    )
    surface_style = ifc_file.createIfcSurfaceStyle(None, "BOTH", [rendering])
    style_item = ifc_file.createIfcPresentationStyleAssignment([surface_style])

    # Get the shape representation items
    if product.Representation:
        for rep in product.Representation.Representations:
            for item in rep.Items:
                styled = ifc_file.createIfcStyledItem(item, [style_item], None)


def _add_property_set(ifc_file, owner_history, product, pset_name, properties):
    """
    Agrega un IfcPropertySet a un producto.

    Args:
        properties: dict {nombre: (valor, tipo)}
            tipo puede ser: "text", "real", "integer", "bool"
    """
    ifc_props = []
    for name, (value, prop_type) in properties.items():
        if prop_type == "text":
            val = ifc_file.createIfcText(str(value))
            prop = ifc_file.createIfcPropertySingleValue(name, None, val, None)
        elif prop_type == "real":
            val = ifc_file.createIfcReal(float(value))
            prop = ifc_file.createIfcPropertySingleValue(name, None, val, None)
        elif prop_type == "integer":
            val = ifc_file.createIfcInteger(int(value))
            prop = ifc_file.createIfcPropertySingleValue(name, None, val, None)
        elif prop_type == "bool":
            val = ifc_file.createIfcBoolean(bool(value))
            prop = ifc_file.createIfcPropertySingleValue(name, None, val, None)
        else:
            continue
        ifc_props.append(prop)

    pset = ifc_file.createIfcPropertySet(
        ifcopenshell.guid.new(), owner_history, pset_name, None, ifc_props
    )
    ifc_file.createIfcRelDefinesByProperties(
        ifcopenshell.guid.new(), owner_history, None, None, [product], pset
    )


def generate_ifc(
    strata: list,
    foundation: dict,
    conditions: dict,
) -> bytes:
    """
    Genera un archivo IFC con el modelo geotécnico completo.

    Args:
        strata: Lista de estratos [{id, thickness, gamma, c, phi, gammaSat}]
        foundation: {type, B, L, Df, FS, beta}
        conditions: {hasWaterTable, waterTableDepth, hasBasement, basementDepth}

    Returns:
        bytes del archivo IFC listo para descargar/visualizar
    """
    # ── Crear archivo IFC ──
    ifc_file = ifcopenshell.file(schema="IFC2X3")
    owner_history = _create_owner_history(ifc_file)

    # ── Unidades (metros, radianes) ──
    length_unit = ifc_file.createIfcSIUnit(None, "LENGTHUNIT", None, "METRE")
    area_unit = ifc_file.createIfcSIUnit(None, "AREAUNIT", None, "SQUARE_METRE")
    volume_unit = ifc_file.createIfcSIUnit(None, "VOLUMEUNIT", None, "CUBIC_METRE")
    angle_unit = ifc_file.createIfcSIUnit(None, "PLANEANGLEUNIT", None, "RADIAN")
    unit_assignment = ifc_file.createIfcUnitAssignment([
        length_unit, area_unit, volume_unit, angle_unit
    ])

    # ── Contexto de representación ──
    world_origin = _create_axis2placement3d(ifc_file, (0.0, 0.0, 0.0))
    context = ifc_file.createIfcGeometricRepresentationContext(
        None, "Model", 3, 1.0E-05, world_origin, None
    )
    sub_context = ifc_file.createIfcGeometricRepresentationSubContext(
        "Body", "Model", None, None, None, None, context, None, "MODEL_VIEW", None
    )

    # ── Proyecto ──
    project = ifc_file.createIfcProject(
        ifcopenshell.guid.new(), owner_history,
        "CimentAviones — Análisis de Capacidad Portante",
        "Modelo geotécnico generado por CimentAviones Web",
        None, None, None, [context], unit_assignment
    )

    # ── Sitio ──
    site_placement = _create_local_placement(ifc_file)
    site = ifc_file.createIfcSite(
        ifcopenshell.guid.new(), owner_history,
        "Sitio de Estudio", "Terreno natural",
        None, site_placement, None, None,
        "ELEMENT", None, None, None, None, None
    )

    # ── Edificio ──
    building_placement = _create_local_placement(ifc_file, site_placement)
    building = ifc_file.createIfcBuilding(
        ifcopenshell.guid.new(), owner_history,
        "Cimentación", "Estructura de cimentación superficial",
        None, building_placement, None, None,
        "ELEMENT", None, None, None
    )

    # ── Piso ──
    storey_placement = _create_local_placement(ifc_file, building_placement)
    storey = ifc_file.createIfcBuildingStorey(
        ifcopenshell.guid.new(), owner_history,
        "Nivel de Desplante", None,
        None, storey_placement, None, None,
        "ELEMENT", 0.0
    )

    # Jerarquía: Project → Site → Building → Storey
    ifc_file.createIfcRelAggregates(
        ifcopenshell.guid.new(), owner_history, None, None, project, [site]
    )
    ifc_file.createIfcRelAggregates(
        ifcopenshell.guid.new(), owner_history, None, None, site, [building]
    )
    ifc_file.createIfcRelAggregates(
        ifcopenshell.guid.new(), owner_history, None, None, building, [storey]
    )

    # ── Dimensiones del terreno ──
    B = foundation["B"]
    L = foundation["L"]
    Df = foundation["Df"]
    f_type = foundation["type"]
    basement_depth = conditions.get("basementDepth", 0) if conditions.get("hasBasement") else 0

    # Para cimentación cuadrada, L debe ser igual a B
    if f_type == "cuadrada":
        L = B

    soil_w = B + 4  # 2m padding cada lado
    soil_l = L + 4

    products = []

    # ══════════════════════════════════════════════
    # ESTRATOS DE SUELO
    # ══════════════════════════════════════════════
    z_offset = 0.0
    for i, stratum in enumerate(strata):
        h = stratum["thickness"]
        color = STRATA_COLORS[i % len(STRATA_COLORS)]

        # Posición: centrado en XY, Z negativo (profundidad)
        # IFC usa Z-up, colocamos la base del estrato en -(z_offset + h)
        placement = _create_local_placement(
            ifc_file, storey_placement,
            origin=(0.0, 0.0, -(z_offset + h))
        )

        shape = _create_box_shape(ifc_file, sub_context, soil_w, soil_l, h)

        slab = ifc_file.createIfcSlab(
            ifcopenshell.guid.new(), owner_history,
            f"E{i + 1} — Estrato {i + 1}",
            f"Estrato de suelo #{i + 1}, φ={stratum['phi']}°, c={stratum['c']}kPa",
            None, placement, shape, None, "BASESLAB"
        )

        _assign_color(ifc_file, slab, sub_context, color)

        # Propiedades geotécnicas
        _add_property_set(ifc_file, owner_history, slab, "Pset_GeotechnicalProperties", {
            "Espesor (m)": (h, "real"),
            "Peso Unitario γ (kN/m³)": (stratum["gamma"], "real"),
            "Cohesión c (kPa)": (stratum["c"], "real"),
            "Ángulo de Fricción φ (°)": (stratum["phi"], "real"),
            "Peso Unitario Sat. γsat (kN/m³)": (stratum["gammaSat"], "real"),
            "Profundidad Techo (m)": (z_offset, "real"),
            "Profundidad Base (m)": (z_offset + h, "real"),
        })

        products.append(slab)
        z_offset += h

    # ══════════════════════════════════════════════
    # CIMENTACIÓN (zapata)
    # ══════════════════════════════════════════════
    pad_height = 0.3
    total_depth = basement_depth + Df

    pad_placement = _create_local_placement(
        ifc_file, storey_placement,
        origin=(0.0, 0.0, -total_depth)
    )

    if f_type == "circular":
        pad_shape = _create_cylinder_shape(ifc_file, sub_context, B / 2, pad_height)
    else:
        pad_shape = _create_box_shape(ifc_file, sub_context, B, L, pad_height)

    footing = ifc_file.createIfcFooting(
        ifcopenshell.guid.new(), owner_history,
        "Zapata", f"Cimentación {f_type} — B={B}m, L={L}m, Df={Df}m",
        None, pad_placement, pad_shape, None, "PAD_FOOTING"
    )
    _assign_color(ifc_file, footing, sub_context, FOUNDATION_COLOR)

    _add_property_set(ifc_file, owner_history, footing, "Pset_FoundationProperties", {
        "Tipo": (f_type, "text"),
        "Ancho B (m)": (B, "real"),
        "Largo L (m)": (L, "real"),
        "Profundidad Df (m)": (Df, "real"),
        "Factor de Seguridad FS": (foundation["FS"], "real"),
        "Espesor Zapata (m)": (pad_height, "real"),
    })

    products.append(footing)

    # ══════════════════════════════════════════════
    # COLUMNA / PEDESTAL
    # ══════════════════════════════════════════════
    # The column extends from the top of the footing pad up to the basement
    # floor level (z = -basement_depth). Without a basement, it reaches z = 0.
    # Height is always Df - pad_height (the space between footing top and
    # the level where the column terminates).
    col_height = Df - pad_height
    if col_height > 0:
        col_w = min(B * 0.3, 0.5)
        # Bottom of column = top of footing = -(basement_depth + Df - pad_height)
        col_placement = _create_local_placement(
            ifc_file, storey_placement,
            origin=(0.0, 0.0, -(basement_depth + col_height))
        )

        col_shape = _create_box_shape(ifc_file, sub_context, col_w, col_w, col_height)

        column = ifc_file.createIfcColumn(
            ifcopenshell.guid.new(), owner_history,
            "Pedestal", f"Pedestal de la zapata — {col_w:.2f}m × {col_w:.2f}m",
            None, col_placement, col_shape, None
        )
        _assign_color(ifc_file, column, sub_context, FOUNDATION_COLOR)
        products.append(column)

    # ══════════════════════════════════════════════
    # NIVEL FREÁTICO (plano de referencia delgado)
    # ══════════════════════════════════════════════
    if conditions.get("hasWaterTable"):
        wt_depth = conditions["waterTableDepth"]
        wt_thickness = 0.02  # plano muy delgado
        wt_size = max(soil_w, soil_l) * 1.2

        wt_placement = _create_local_placement(
            ifc_file, storey_placement,
            origin=(0.0, 0.0, -(wt_depth + wt_thickness))
        )
        wt_shape = _create_box_shape(ifc_file, sub_context, wt_size, wt_size, wt_thickness)

        water_proxy = ifc_file.createIfcBuildingElementProxy(
            ifcopenshell.guid.new(), owner_history,
            f"Nivel Freático (NF -{wt_depth:.2f}m)",
            "Plano indicador del nivel freático",
            None, wt_placement, wt_shape, None, None
        )
        _assign_color(ifc_file, water_proxy, sub_context, WATER_COLOR)
        products.append(water_proxy)

    # ── Vincular todos los productos al piso ──
    ifc_file.createIfcRelContainedInSpatialStructure(
        ifcopenshell.guid.new(), owner_history,
        None, None, products, storey
    )

    # ── Escribir a bytes ──
    tmp = tempfile.NamedTemporaryFile(suffix=".ifc", delete=False)
    tmp_path = tmp.name
    tmp.close()

    ifc_file.write(tmp_path)
    with open(tmp_path, "rb") as f:
        data = f.read()

    Path(tmp_path).unlink(missing_ok=True)
    return data
