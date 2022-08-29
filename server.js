const hostname = "192.168.68.106";
const port = 8000;

const express = require("express");
const cors = require("cors");
const fileUpload = require("express-fileupload");
const ffmpeg = require("fluent-ffmpeg");
const ffprobe = require("ffprobe"),
  ffprobeStatic = require("ffprobe-static");
const fs = require("fs");
const uniqueFilename = require("unique-filename");

var videoFile = null;
let logo = `logo.mp4`;
var movie_duration = 0;
var pos_value = "0:0";
var progress_value = 0;
var randomTmpfile = "";
var WMposition = "Down";
console.log("Progess value init");

var app = express("");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

app.post("/upload", (req, res) => {
  randomTmpfile = uniqueFilename("") + ".mp4";
  videoFile = req.files.file;
  WMposition = req.body.WMposition;
  progress_value = 0;
  movie_duration = 0;
  console.log("Progess value set");

  videoFile.mv(`${__dirname}/tmp/${videoFile.name}`, function (err) {
    if (err) {
      return res.status(500).send(err);
    }

    console.log(`File ${videoFile.name} Uploaded successfully`);
    console.log(`Watermark in ${WMposition}`);

    ffprobe(`tmp/${videoFile.name}`, { path: ffprobeStatic.path })
      .then(function (info) {
        movie_duration = info.streams[0].nb_frames;

        addVideoWaterMarkwFFMPEG(res);
      })
      .catch(function (err) {
        console.error(err);
      });
  });
});

app.get("/progress", (req, res) => {
  res.json({ progress: progress_value });
});

app.post("/download", (req, res) => {
  res.download("tmp/" + randomTmpfile, randomTmpfile, function (err) {
    if (err) throw err;
    fs.unlink("tmp/" + randomTmpfile, function (err) {
      if (err) throw err;
      randomTmpfile = "";
      console.log("File deleted");
    });
  });
});

app.get("/cleanup", (req, res) => {
  console.log("Cleanup" + randomTmpfile);
  if (randomTmpfile != "") {
    fs.unlink("tmp/" + randomTmpfile, function (err) {
      if (err) throw err;
      console.log("File deleted");
    });
  }
  res.send("Clean Executed");
});

app.get("/test",(req,res) =>{
  console.log("Test working");
  res.send(`Test running at http://${hostname}:${port}/`)
})

/*app.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});*/

app.listen(port, () => {
  console.log(`Server running at port:${port}/`);
});

addVideoWaterMarkwFFMPEG = (response) => {
  switch (WMposition) {
    case "Top":
      pos_value = "(W*0.5-w*0.5):(H*0.1)";
      break;
    case "Left":
      pos_value = "(W*0.1):(H*0.9-h)";
      break;
    case "Right":
      pos_value = "(W*0.9-w):(H*0.9-h)";
      break;
    case "Down":
      pos_value = "(W*0.5-w*0.5):(H*0.9-h)";
      break;
  }

  ffmpeg(`tmp/${videoFile.name}`)
    .addInput(`res/${logo}`)
    .addInputOption("-stream_loop -1")
    .complexFilter([
      "[1:v]chromakey=0x70de77:0.1:0.2 [logot];[logot][0:v]scale2ref=w=oh*mdar:h=ih/6[logoout][videoout];[videoout][logoout]overlay=" +
        pos_value +
        ":shortest=1",
    ])

    .outputOption("-c:v libx264")
    .outputOption("-crf 16")
    .outputOption("-preset slow")

    .on("end", function (stdout, stderr) {
      console.log("Finished");

      response.download("tmp/" + randomTmpfile, function (err) {
        if (err) throw err;
      });

      fs.unlink("tmp/" + videoFile.name, function (err) {
        if (err) throw err;
        console.log("File deleted");
      });
    })

    .on("error", function (err) {
      console.log("an error happened: " + err.message);
      fs.unlink("tmp/" + videoFile.name, function (err) {
        if (err) throw err;
        console.log("File deleted");
      });
    })

    .on("progress", function (info) {
      progress_value = Math.round((info.frames / movie_duration) * 100);
      console.log("progress: " + progress_value + "%");
    })

    .saveToFile("tmp/" + randomTmpfile);
};
