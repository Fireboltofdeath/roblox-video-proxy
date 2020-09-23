const app = require("express")();
const request = require("request");
const zlib = require("zlib");
const http = require("https");

app.use(require("cors")());

function getCdnUrl(id) {
	return new Promise((resolve, reject) => {
		request.get("https://assetdelivery.roblox.com/v1/asset/?id=" + id, (err, resp) => {
			if (err) return reject(err);
			resolve(resp.request.uri.href);
		});
	});
}

app.get("/asset/:id/cdn", (req, res) => {
	getCdnUrl(req.params.id)
		.then(url => res.send(url))
		.catch(() => res.status(500).send());
})

app.get("/asset/:id", (req, res) => {
	getCdnUrl(req.params.id)
		.then(url => {
			request.get(url, {encoding: null}, (err, _, body) => {
				if (err) return res.status(500).send();
				zlib.gunzip(body, (err, dezip) => {
					if (err) return res.status(500).send();
					res.set('Content-Type', 'video/webm');
					res.set("Content-Disposition", `attachment; filename=video-${req.params.id}.webm`)
					res.send(dezip);
				});
			});
		})
		.catch(() => res.status(500).send());
});

console.log(`Listening to port ${process.env.PORT}`);
app.listen(process.env.PORT);