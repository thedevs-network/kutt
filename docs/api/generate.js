const { join, dirname } = require("node:path");
const { promises: fs } = require("node:fs");

const api = require("./api");

const Template = (output, { api, title, redoc }) =>
	fs.writeFile(output,
`<DOCTYPE html>
<html>
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<meta http-equiv="X-UA-Compatible" content="ie=edge" />
		<title>${title}</title>
	</head>
	<body>
		<redoc spec-url="${api}" />
		<script src="${redoc}"></script>
	</body>
</html>
`);

const Api = output =>
	fs.writeFile(output, JSON.stringify(api));

const Redoc = output =>
	fs.copyFile(join(
		dirname(require.resolve("redoc")),
		"redoc.standalone.js"),
		output);

module.exports = (async () => {
	const out = join(__dirname, "static");
	const apiFile = "api.json";
	const redocFile = "redoc.js";
	await fs.mkdir(out, { recursive: true });
	return Promise.all([
		Api(join(out, apiFile)),
		Redoc(join(out, redocFile)),
		Template(join(out, "index.html"), {
			api: apiFile,
			title: api.info.title,
			redoc: redocFile
		}),

	]);
})();
