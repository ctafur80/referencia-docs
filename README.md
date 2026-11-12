# Mi biblioteca

Este repositorio guarda la selección personal de documentos, separada del sistema
Astro y de los repositorios con sus contenidos. Requiere Git y Node.js 22.23.4 o
posterior. No necesita instalar paquetes propios.

## Probar con una copia local del sistema

Desde este directorio, si el sistema está en la carpeta vecina `docs-astro`:

```sh
node library.mjs dev --system ../docs-astro
```

Se usa esta copia de `documents.yaml`, se descargan los documentos y se inicia
Astro. Un catálogo vacío muestra una biblioteca vacía. No se modifica el catálogo
del sistema. Detén cualquier servidor anterior antes de cambiar de biblioteca.

```sh
node library.mjs sync --system ../docs-astro
node library.mjs check --system ../docs-astro
node library.mjs build --system ../docs-astro
node library.mjs preview --system ../docs-astro
```

Con `--system` utilizas tu copia de trabajo, incluidos sus cambios sin commit.
Los contenidos se descargan en `src/documents/` de esa copia. Para trabajar con
varias bibliotecas simultáneamente, utiliza copias distintas del sistema.

## Configurar una generación independiente

1. Añade los repositorios de documentos a `documents.yaml`. Cada entrada requiere
   `slug`, `repository` y `ref`.
2. Configura `system.json` con la URL del repositorio del sistema Astro y su rama,
   etiqueta o SHA completo. Los valores están vacíos hasta conocer el remoto.

```json
{
  "repository": "https://github.com/USUARIO/docs-astro.git",
  "ref": "ETIQUETA_O_SHA_DEL_SISTEMA"
}
```

La versión elegida debe incluir el soporte para `DOCUMENTS_MANIFEST`.
Fijar un commit permite conservar la versión del sistema de cada biblioteca.

Después puedes ejecutar:

```sh
node library.mjs build
node library.mjs preview
```

El sistema se descarga en `.cache/system/`, se instalan sus dependencias con
`npm ci`, se descargan los documentos y se genera `.cache/system/dist/`.
`.cache/` se excluye de este Git. `preview` sirve el resultado existente sin
actualizar ni instalar nada. `dev`, `sync` y `check` también admiten el modo
independiente; `check` necesita que los documentos ya estén descargados.

## GitHub Actions

El flujo `.github/workflows/build.yml` genera la biblioteca al hacer push, al
lanzarlo manualmente o al recibir `repository_dispatch` de tipo
`documents-updated`. Guarda la web y los commits exactos del sistema y los
documentos como artefactos. El despliegue a un alojamiento se añadirá cuando
se decida dónde publicar.

Para repositorios privados de GitHub por HTTPS, configura el secreto
`DOCUMENTS_TOKEN` con permiso de lectura para el sistema y los documentos.
En local también puedes usar tus credenciales o SSH. Un cambio en un repositorio
de documentos requiere lanzar una generación o enviar el evento indicado.

## Contribuir al sistema

Los cambios de plantilla, estilos o scripts se hacen en el repositorio del sistema
y se proponen mediante un PR allí. Este catálogo tiene su propio historial y
permanece en este repositorio. No añadas el catálogo personal al PR del sistema.
