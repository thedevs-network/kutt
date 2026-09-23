# Atajo Privado Para iOS

Este ejemplo crea un enlace en tu cuenta Kutt desde la hoja de compartir de iOS
o una URL introducida manualmente, y copia el enlace corto recibido. Reutiliza
enlaces compatibles (`reuse: true`); esto no garantiza idempotencia ni reintentos
sin duplicados. El token del dominio predeterminado puede crear enlaces, pero no
listarlos, editarlos, eliminarlos, leer estadísticas, gestionar tokens o usuarios,
ni usar dominios personalizados. Las redirecciones cortas siguen siendo públicas.

## Configuración

1. Inicia sesión en Kutt con tu SSO habitual. Abre Ajustes > Atajo de iOS.
2. Descarga `Kutt-Shorten-URL.shortcut` y ábrelo en Atajos de Apple. Revisa sus
   acciones: la plantilla contiene ejemplos, nunca credenciales. Sus mensajes
   integrados siguen en inglés para conservar la firma.
3. Asigna al token un nombre específico del dispositivo y elige Crear token para
   Atajos. Copia la dirección HTTPS exacta de la API y la credencial que se muestra
   una sola vez en las dos preguntas de importación. La URL debe terminar en
   `/api/v2/links`; no uses una dirección de inicio de sesión, un enlace corto,
   HTTP, un túnel ni un servicio externo. Oculta la credencial al guardarla, o
   revócala si abandonas la configuración.
4. Termina de añadir el atajo. Comparte una URL desde Safari y elige este atajo.
   Selecciona la URL correcta si la aplicación proporciona varias. Si lo ejecutas
   directamente, introduce la URL solicitada. La URL compartida es un dato JSON,
   nunca la dirección del servidor HTTP.
5. Si Atajos solicita permiso de red, autoriza solo el host previsto de la API
   Kutt. Cancela destinos inesperados. Comprueba una vez el enlace corto copiado.

La acción de Apple «Obtener contenido de URL» puede seguir redirecciones. Se
requiere una dirección HTTPS exacta y de confianza que acepte directamente el
token restringido, sin redirigir al SSO ni a otro host. No autorices destinos
inesperados ni debilites el WAF o el SSO. Las peticiones API válidas reciben JSON,
no un formulario de acceso. Solo se realiza un POST, sin reintentos automáticos
ni solicitudes al destino compartido.

## Credenciales Y Renovación

El token caduca a los 30 días y solo se muestra una vez. Kutt guarda su hash.
Atajos almacena el texto configurado localmente y puede sincronizarlo con tu
cuenta Apple; no es un almacén de contraseñas. Nunca publiques, exportes para
compartir, subas, firmes ni envíes una copia configurada que contenga un token.
La plantilla firmada suministrada no contiene credenciales. La copia al
portapapeles es local al dispositivo; borra su contenido sensible después de
configurarlo. Usa un token diferente por dispositivo.

Para renovar, crea un reemplazo en Kutt, actualiza solo tu atajo privado, pruébalo
y revoca el token anterior con nombre en Ajustes > Tokens API. Si pierdes el
dispositivo o sospechas una filtración, revoca primero. La revocación se aplica
en la siguiente petición. No lo sustituyas por una clave API antigua o de administrador.

## Errores Y Recuperación

- 401: token caducado/revocado o cuenta inactiva. Inicia sesión y crea un token
  restringido nuevo. No automatices credenciales de renovación ilimitadas.
- 403: restricción de permisos/dominio o bloqueo del WAF. Revisa los registros
  de Kutt y del WAF en privado; conserva las restricciones y el WAF activado.
- 429: espera antes de volver a intentarlo manualmente; no añadas un bucle.
- Tiempo de espera agotado: el servidor podría haber creado el enlace. Revisa
  Biblioteca antes de reintentar. `reuse` reduce duplicados ordinarios, pero no
  garantiza una única ejecución.
- Falta `link`, la respuesta no es JSON o contiene `error`: no se copia nada.
  Comprueba la dirección API y el servicio. Los fallos nativos de transporte
  también detienen el atajo.
- Falta de entrada o cancelación: no se envía ninguna petición. Las redirecciones
  públicas no dependen del atajo, de un token ni del SSO.

No se necesita una nueva migración de base de datos: se usan la tabla existente
de tokens restringidos con hash y la API de enlaces. Haz las copias de seguridad
habituales. Tras una recuperación, comprueba caducidad, revocación y acceso a la
cuenta; revoca tokens de dispositivos perdidos. No vuelvas a una versión que
ignore las restricciones de dominio. Eliminar la página de configuración no
revoca tokens ya emitidos; revócalos explícitamente primero.

## API

`/api` y `/api/v2` admiten estas rutas exclusivas de sesiones autenticadas:

- `GET /shortcuts`: dirección exacta, política fija del token, ejemplo y descargas.
- `POST /shortcuts/token` con `{"name":"Mi iPhone"}`: HTTP 201 con el token que se
  muestra una sola vez, su ID, el permiso fijo `links:create`, dominio predeterminado
  y caducidad de 30 días. Se rechazan otros campos. Cinco creaciones por minuto y
  cliente cuando está activo el límite. Se aplican las reglas de mismo origen y CSRF.
- `GET /shortcuts/template`: plantilla nativa firmada sin credenciales, como adjunto.
- `GET /shortcuts/guide`: esta guía. Todas las respuestas son privadas/no-store.

Los tokens API restringidos y las claves antiguas no pueden emitir credenciales
ni descargar recursos privados de configuración, incluso con una cookie de
administrador. Revoca con `DELETE /tokens/{id}`, exclusivo de sesiones; solo el
propietario puede revocar su token.

## Reproducir La Plantilla

`examples/ios-shortcut.cjs` es el grafo de acciones auditable. No contiene scripts
externos, direcciones específicas de cuentas, tokens, redirecciones ni código
remoto ejecutable. `scripts/build-shortcut.py` genera un plist XML determinista:

```sh
python3 scripts/build-shortcut.py --output /tmp/Kutt-Shorten-URL.unsigned.shortcut
shortcuts sign --mode anyone --input /tmp/Kutt-Shorten-URL.unsigned.shortcut --output examples/Kutt-Shorten-URL.shortcut
chmod 0644 examples/Kutt-Shorten-URL.shortcut
```

La firma requiere macOS y el servicio de Apple. Firma solo la plantilla con
ejemplos, nunca con un token real. Antes de publicar cambios, revisa el grafo,
ejecuta las pruebas, compruébalo en Atajos y verifica los bytes descargados.
La CI Linux valida el grafo fuente y la suma de comprobación; no ejecuta un
iPhone. La CI macOS también usa `python3 scripts/verify-shortcut.py` para decodificar
el archivo firmado sin importarlo ni ejecutarlo, y comparar acciones y preguntas
de importación con la fuente revisada. Comprueba la firma con la clave integrada,
no una cadena de confianza independiente de la autoridad de Apple.

La plantilla de referencia se probó en Atajos de macOS con credenciales ficticias
y un servidor local (JSON correcto, error API y cancelación). La configuración
web tiene pruebas independientes de escritorio/móvil. No se ha validado en un
iPhone físico; sigue las comprobaciones anteriores al realizar la primera
importación privada.

Referencias de Apple: [peticiones HTTP](https://support.apple.com/guide/shortcuts/request-your-first-api-apd58d46713f/ios),
[preguntas de importación](https://support.apple.com/guide/shortcuts/add-import-questions-to-shared-shortcuts-apdf330fd3a0/ios),
[privacidad al compartir](https://www.apple.com/legal/privacy/data/en/shortcuts-sharing/).
