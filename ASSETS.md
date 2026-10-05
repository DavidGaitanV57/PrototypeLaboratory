# ASSETS.md — Cómo preparar un paquete de assets

Especificación de lo que acepta **Generate Prototype with Assets**. Es independiente del género: el
mismo formato sirve para un laberinto, un juego de carreras, un plataformas o un shooter. Lo que
cambia de un juego a otro es el *contenido* del paquete, nunca su estructura.

Todo vive en `public/assets/` (se sirve en `/assets/...`). El lab admite dos tipos de asset:

| Tipo | Qué es | Para qué lo usa el juego | Necesita JSON |
|------|--------|--------------------------|---------------|
| **Modelo** | `.glb` / `.gltf` | Props, muebles, landmarks, obstáculos, personajes | No |
| **Set de material** | Carpeta con texturas PBR que se repiten (tiling) | Suelos, paredes, techos, terreno, caminos | Opcional (`material.json`) |

---

## 1. Estructura de carpetas

```
public/assets/
├── furniture.glb                     ← modelo (puede contener muchos objetos)
├── characters/
│   └── guard.glb                     ← modelo animado
├── backrooms/
│   ├── carpet/                       ← set de material "backrooms/carpet"
│   │   ├── carpet_color.png
│   │   ├── carpet_normal.png
│   │   ├── carpet_rough.png
│   │   └── material.json             ← opcional
│   ├── wallpaper/                    ← set "backrooms/wallpaper"
│   │   └── …
│   └── preview/                      ← ignorada (miniaturas para humanos)
└── outdoor/
    └── textures/                     ← varios sets en una carpeta (ver §3.4)
        ├── grass_color.jpg
        ├── grass_normal.jpg
        ├── grass.material.json
        ├── dirt_color.jpg
        └── dirt_normal.jpg
```

- Se admiten subcarpetas a cualquier profundidad y cualquier número de archivos.
- Se ignoran las carpetas `preview`, `previews`, `thumb`, `thumbs`, `thumbnails` y las que empiezan por `_` o `.`.
- `library.json` en la raíz de `public/assets/` es un nombre **reservado**: lo genera el lab.
- Los binarios no van a git (`.gitignore`); guarda el paquete en tu propio almacenamiento.

---

## 2. Modelos (`.glb` / `.gltf`)

No llevan JSON: el lab lee la cabecera del glTF y obtiene los nombres de los objetos, su tamaño y sus animaciones.

| Requisito | Por qué |
|-----------|---------|
| **Nombres de objeto descriptivos** (`Folding Chair`, `Police Car`, no `Mesh_042`) | El LLM elige qué usar **solo por el nombre**. Es el dato más importante del paquete. |
| **Unidades en metros, eje Y arriba** (exportador glTF por defecto) | El lab informa los tamaños en metros; el juego los escala a medidas reales. |
| **Un objeto = un hijo de la raíz de la escena** | Cada hijo de primer nivel se puede colocar por separado. Un archivo con 30 muebles es válido. |
| **Origen del objeto en la base o el centro** | Al colocarlo se apoya en el suelo y se centra automáticamente; un origen muy desplazado no rompe nada, pero ayuda. |
| **Texturas embebidas** (`.glb`) o junto al `.gltf` | Un `.gltf` con sus imágenes al lado no se confunde con un set de material. |
| **Animaciones con nombre** (`Idle`, `Run`, `Attack`) | El LLM las ve en la lista y las reproduce por nombre. |
| **Variantes de detalle con sufijo claro** (`_LP` / `_HQ`, `_low` / `_high`) | Se le indica usar la más ligera. |
| **Peso razonable** (ideal < 50 MB por archivo) | El juego carga los archivos que usa durante la intro. Mejor varios archivos temáticos que uno gigante. |

Compresiones soportadas: sin comprimir y Meshopt (`EXT_meshopt_compression`). Draco no está soportado.

---

## 3. Sets de materiales

Un set es un grupo de imágenes con el **mismo nombre base** y distinto **sufijo de mapa**:
`carpet_color.png`, `carpet_normal.png`, `carpet_rough.png` → set `carpet`.

### 3.1 Formatos de imagen

`.png`, `.jpg` / `.jpeg`, `.webp`. Las texturas deben ser **seamless** (que se repitan sin costura).
Resolución recomendada: 1024×1024 (2048 para superficies que se ven de cerca). Potencias de 2.

### 3.2 Sufijos reconocidos

El sufijo va al final, separado por `_`, `-`, `.` o espacio. Da igual mayúsculas o minúsculas. Un
token de resolución final (`_1k`, `_2k`, `_2048`) se ignora, así que funcionan tal cual los paquetes
de ambientCG y Poly Haven.

| Mapa | Sufijos aceptados | Contenido |
|------|-------------------|-----------|
| `color` | `color`, `colour`, `albedo`, `basecolor`, `base_color`, `diffuse`, `diff`, `col`, `alb` | Color base (sRGB) |
| `normal` | `normal`, `normalgl`, `nor_gl`, `nrm`, `nor`, `norm` | Normal map, convención OpenGL |
| `normal` (DX) | `normaldx`, `normal_dx`, `nor_dx` | Normal map DirectX (el lab invierte el canal verde) |
| `roughness` | `roughness`, `rough`, `rgh` | Rugosidad (blanco = mate) |
| `metalness` | `metalness`, `metallic`, `metal`, `met` | Metalicidad (blanco = metal) |
| `ao` | `ao`, `ambientocclusion`, `ambient_occlusion`, `occlusion`, `occ` | Oclusión ambiental |
| `orm` | `orm`, `arm` | Empaquetado: **R** = AO, **G** = rugosidad, **B** = metalicidad |
| `height` | `height`, `heightmap`, `displacement`, `disp`, `bump` | Altura / relieve |
| `emissive` | `emissive`, `emission`, `emit`, `glow` | Zonas que brillan (sRGB) |
| `opacity` | `opacity`, `alpha`, `mask`, `transparency` | Transparencia (blanco = opaco) |

Mínimo para que un set exista: **`color`**, o en su defecto `orm` o `normal`. Una imagen sin sufijo
reconocido (p. ej. `carpet.png`) se ignora.

### 3.3 Id del set

Es como el juego lo pide (`loadMaterial("backrooms/carpet")`):

- **Un set por carpeta** (recomendado): id = ruta de la carpeta → `backrooms/carpet`.
- **Varios sets en una carpeta**: id = carpeta + nombre base → `outdoor/textures/grass`.

### 3.4 Dónde va el JSON

- Un set por carpeta → `material.json` dentro de esa carpeta.
- Varios sets en una carpeta → `<base>.material.json` (p. ej. `grass.material.json`).

Sin JSON el set funciona igual. El lab deduce las superficies por el nombre (`carpet` → floor,
`wall` → wall, `ceiling` → ceiling…; si no reconoce nada → `any`), usa `tileSize` = 2 m y marca
ambos datos como **(guessed)** para que el LLM sepa que son suposiciones.

---

## 4. `material.json` — referencia

### 4.1 Plantilla completa

Copia esto y borra lo que no necesites. **Todos los campos son opcionales.**

```json
{
  "version": 1,
  "name": "Moqueta húmeda",
  "description": "Moqueta amarillenta de oficina, gastada y con manchas de humedad.",
  "surfaces": ["floor"],
  "tags": ["backrooms", "interior", "office", "dirty"],
  "tileSize": 2,
  "maps": {
    "color": "carpet_color.png",
    "normal": "carpet_normal.png",
    "roughness": "carpet_rough.png"
  },
  "normalConvention": "gl",
  "tint": "#ffffff",
  "roughness": 1,
  "metalness": 0,
  "normalScale": 1,
  "height": { "mode": "bump", "scale": 1 },
  "emissive": "#000000",
  "emissiveIntensity": 1,
  "transparent": false,
  "alphaTest": 0,
  "doubleSided": false
}
```

### 4.2 Plantilla mínima recomendada

Con esto basta en el 90 % de los casos: dice al juego **dónde va** y **a qué escala**.

```json
{
  "version": 1,
  "description": "Papel tapiz amarillo con patrón de rombos, años 90.",
  "surfaces": ["wall"],
  "tileSize": 1.5
}
```

### 4.3 Campos

| Campo | Tipo | Valores | Por defecto | Qué hace |
|-------|------|---------|-------------|----------|
| `version` | número | `1` | `1` | Versión del formato. |
| `name` | texto | — | nombre base legible | Nombre que ve el LLM. |
| `description` | texto | máx. ~160 caracteres útiles | `""` | **Muy recomendable.** Ayuda al LLM a elegir el set adecuado para la ficción del TDD. |
| `surfaces` | lista | ver §4.4 | deducido del nombre | Dónde puede ir el material. El LLM asigna los sets por este campo. |
| `tags` | lista de texto | libre | `[]` | Estilo, época, ambiente (`scifi`, `medieval`, `wet`, `clean`…). |
| `tileSize` | número o `[ancho, alto]` | metros, 0.01–1000 | `2` | **Cuánto mide en el mundo real una repetición de la textura.** Ver §4.5. |
| `maps` | objeto | claves de §3.2 → nombre de archivo en la carpeta | detección por sufijo | Asignación manual cuando los nombres no siguen la convención. Se combina con la detección. |
| `normalConvention` | texto | `"gl"`, `"dx"` | `"gl"` (o `"dx"` si el sufijo es `NormalDX`) | Convención del normal map. Si el relieve se ve "hundido" al revés, cambia este valor. |
| `tint` | color hex | `"#rrggbb"` | `"#ffffff"` | Multiplica el color base. Blanco = sin cambio. |
| `roughness` | número | 0–1 | `1` | Rugosidad; multiplica el mapa si existe. |
| `metalness` | número | 0–1 | `1` con mapa de metal/ORM; si no, `0` | Metalicidad; multiplica el mapa si existe. |
| `normalScale` | número | 0–10 | `1` | Intensidad del relieve del normal map. |
| `height` | objeto | `{ "mode": "bump" \| "displacement" \| "none", "scale": n }` | `none` si hay normal map; si no, `bump` | Uso del mapa de altura (§4.6). |
| `emissive` | color hex | `"#rrggbb"` | `"#ffffff"` con mapa emisivo; si no, `"#000000"` | Color de emisión. |
| `emissiveIntensity` | número | 0–100 | `1` | Fuerza del brillo (con bloom, >1 resplandece). |
| `transparent` | booleano | `true` / `false` | `true` si hay mapa de opacidad | Activa la transparencia (cristal, agua). |
| `alphaTest` | número | 0–1 | `0` | Recorte duro por alfa (vallas, rejillas, follaje). Con `0.5` los píxeles semitransparentes desaparecen. |
| `doubleSided` | booleano | `true` / `false` | `false` | Se ve por las dos caras (vallas, telas, carteles finos). |

Claves extra como `$schema` se aceptan y se ignoran.

### 4.4 Vocabulario de `surfaces`

Cerrado a propósito, para que cualquier juego pueda casar roles con sets:

| Valor | Úsalo para |
|-------|-----------|
| `floor` | Suelos interiores: moqueta, parquet, baldosa, metal de nave |
| `wall` | Paredes y muros: papel tapiz, ladrillo, yeso, paneles |
| `ceiling` | Techos: placas, hormigón, vigas |
| `ground` | Terreno exterior: hierba, tierra, arena, nieve, roca |
| `path` | Caminos y pistas: asfalto, adoquín, gravilla, pista de carreras |
| `trim` | Remates y piezas pequeñas: rodapiés, marcos, bordes, columnas |
| `water` | Agua, líquidos, superficies de piscina |
| `any` | Material neutro que sirve en cualquier sitio |

Un set puede tener varios: `"surfaces": ["floor", "wall"]` para unas baldosas de piscina.

### 4.5 Cómo medir `tileSize`

`tileSize` = los metros reales que cubre la imagen **una vez**, de borde a borde.

1. Cuenta cuántos elementos reconocibles hay en la imagen (baldosas, ladrillos, tablas, placas).
2. Multiplica por su tamaño real.

| Textura | Elementos en la imagen | Tamaño real | `tileSize` |
|---------|------------------------|-------------|------------|
| Placas de techo de oficina | 2 × 2 placas | 0.6 m | `1.2` |
| Baldosa de piscina | 8 × 8 baldosas | 0.15 m | `1.2` |
| Ladrillo | 4 ladrillos de largo × 12 hileras | 0.25 m × 0.075 m | `[1, 0.9]` |
| Papel tapiz | 2 repeticiones del motivo | 0.5 m | `1` |
| Hierba / tierra (sin elementos claros) | — | escala visual | `3`–`5` |
| Asfalto | — | escala visual | `4` |

Usa `[ancho, alto]` cuando la imagen no es cuadrada en el mundo real (ladrillos, tablas). En
paredes, *alto* es el eje vertical; en suelos y techos, la profundidad.

### 4.6 Modos de `height`

| Modo | Coste | Cuándo |
|------|-------|--------|
| `none` | 0 | Ya hay normal map (lo normal); el relieve lo da el normal. |
| `bump` | bajo | No hay normal map: usa la altura para simular relieve. `scale` típico 0.5–2. |
| `displacement` | alto | Desplaza la geometría de verdad (piedras sueltas, adoquín muy marcado). Solo luce en superficies subdivididas. `scale` en metros, típico 0.02–0.1. |

---

## 5. Validación

El lab nunca falla por un JSON mal escrito:

- **JSON inválido** → se ignora el archivo y el set usa los valores deducidos.
- **Campo con valor incorrecto** (p. ej. `"roughness": 2`) → se descarta ese campo y se usa el valor por defecto.
- **Clave desconocida** (p. ej. `"colour"`) → se ignora.
- **`maps` apunta a un archivo inexistente** → se ignora esa entrada.

Cada caso deja un aviso visible en:

- el log de **Generate Prototype with Assets** (`Material backrooms/carpet: material.json: "roughness" must be 0..1 — ignored`);
- `GET /api/assets` → `materials[].warnings`.

Para ver cómo interpreta el lab tu paquete sin generar nada: abre `/api/assets` (resumen con
avisos) o `/assets/library.json` (los materiales tal como los cargará el juego).

---

## 6. Ejemplos por género

**Terror / backrooms**: moqueta (`floor`, 2 m), papel tapiz (`wall`, 1 m), placas de techo (`ceiling`, 1.2 m) + GLB de muebles de oficina y luces de techo.

**Carreras**: asfalto (`path`, 4 m), bordillo rojo y blanco (`trim`, `[2, 0.3]`), hierba (`ground`, 4 m) + GLB de coches, conos, gradas y barreras.

**Plataformas fantasía**: piedra musgosa (`ground`, `wall`, 2 m), madera (`floor`, `trim`, `[2, 0.25]`) + GLB de cofres, setas y monedas.

**Sci-fi**: panel metálico (`floor`, `wall`, 2 m, `metalness` 1), franjas de neón (`trim`, `emissiveIntensity` 3) + GLB de cajas, terminales y robots animados.

**Rejas / vallas** (válido en cualquier género):

```json
{
  "version": 1,
  "surfaces": ["wall", "trim"],
  "tileSize": [2, 2],
  "alphaTest": 0.5,
  "doubleSided": true
}
```

---

## 7. Checklist antes de generar

- [ ] Los objetos de los `.glb` tienen nombres que describen qué son.
- [ ] Los modelos están en metros y con Y arriba.
- [ ] Cada set de textura está en su carpeta, con sufijos de §3.2 y al menos `_color`.
- [ ] Las texturas son seamless.
- [ ] Cada set tiene `material.json` con al menos `surfaces`, `tileSize` y una `description`.
- [ ] `/api/assets` no muestra avisos inesperados.
- [ ] El paquete encaja con la ficción del TDD (si no encaja, el juego usará primitivas para lo que falte).
