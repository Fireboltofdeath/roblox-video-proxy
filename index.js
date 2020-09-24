const app = require("express")();
const request = require("request");
const zlib = require("zlib");
const fs = require("fs");
const hbjs = require('handbrake-js')

const http = require("https");

if (!fs.existsSync("temp")) {
	fs.mkdirSync("temp")
}

app.use(require("cors")());

function getCdnUrl(id) {
	return new Promise((resolve, reject) => {
		request.get("https://assetdelivery.roblox.com/v1/asset/?id=" + id, (err, resp) => {
			if (err) return reject(err);
			resolve(resp.request.uri.href);
		});
	});
}

function getDecompressedVideo(id) {
	return new Promise((resolve, reject) => {
		getCdnUrl(id)
			.then(url => {
				request.get(url, {encoding: null}, (err, resp, body) => {
					if (err) return reject("failed to get video");
					if (resp.headers["content-encoding"] == "gzip") {
						zlib.gunzip(body, (err, dezip) => {
							if (err) return reject("gunzip failed");
							resolve(dezip);
						});
					} else {
						resolve(body);
					}
				});
			})
			.catch(() => reject("failed to get cdn url"));
	});
}

app.get("/asset/:id/cdn", (req, res) => {
	getCdnUrl(req.params.id)
		.then(url => res.send(url))
		.catch(() => res.status(500).send("failed to get cdn url"));
})

app.get("/asset/:id", (req, res) => {
	getDecompressedVideo(req.params.id)
		.then(video => {
			res.set('Content-Type', 'video/webm');
			res.set("Content-Disposition", `attachment; filename=video-${req.params.id}.webm`)
			res.send(video);
		})
		.catch(err => res.status(500).send(err));
});

app.get("/asset/:id/format/:format", (req,res) => {
	if (['webm', 'mp4'].includes(req.params.format)) {
		getDecompressedVideo(req.params.id)
			.then(video => {
				if (req.params.format === "webm") {
					res.set('Content-Type', 'video/webm');
					res.set("Content-Disposition", `attachment; filename=video-${req.params.id}.webm`)
					return res.send(video);
				}
				let fileName = Buffer.from(`${req.connection.remoteAddress}-${req.params.id}-${Math.floor(Math.random() * 100000000)}`).toString("base64");
				fs.writeFile(`./temp/${fileName}.webm`, video, err => {
					if (err) return res.status(500).send("failed to write video");
					hbjs.spawn({ input: `./temp/${fileName}.webm`, output: `./temp/${fileName}.mp4` })
						.on("error", () => {
							res.status(500).send("Encoding failed");
							fs.unlink(`./temp/${fileName}.webm`);
						})
						.on("end", () => {
							res.set("Content-Disposition", `attachment; filename=video-${req.params.id}.${req.params.format}`)
							res.sendFile(__dirname + `/temp/${fileName}.mp4`, err => {
								if (err) return (!res.headersSent) && res.status(500).send("sending file failed");
								fs.unlink(`./temp/${fileName}.webm`, err => err && console.log(err));
								fs.unlink(`./temp/${fileName}.mp4`, err => err && console.log(err));
							});
						})
				});
			})
			.catch(err => res.status(500).send(err));
	} else {
		res.status(404).send("format not available");
	}
})

console.log(`Listening to port ${process.env.PORT}`);
app.listen(process.env.PORT);