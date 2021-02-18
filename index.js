// Import the modules
var express = require("express");
var bodyParser = require('body-parser');
var multer = require('multer');
var path = require('path');
var fs = require("fs");
var engine = require('consolidate');
const WaveFile = require('wavefile').WaveFile;
var sdk = require("microsoft-cognitiveservices-speech-sdk");
const cons = require("consolidate");

//App Variables & configuration
var app = express();
var router = express.Router();
const port = process.env.PORT || 8081;

app.use(bodyParser.json());
app.use(express.static('public'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', __dirname + '/views');
var path1 = __dirname + '/views/';
router.use(function (req, res, next) {
    console.log("/" + req.method);
    next();
});
app.use("/", router);

// Cognitive Service Key and variables
var subscriptionKey = "*****************************";
var serviceRegion = "****";
var selectedlang ;

// file upload variables
var storage = multer.diskStorage({
    destination: function(req, file, callback) {
        callback(null, './public/uploads');
    },
    filename: function(req, file, callback) {
        callback(null,"audio.wav");
    }
});
var upload = multer({storage: storage});

//// Routes Definitions
app.get("/", function (req, res) {
    res.sendFile(path1 + "index.html");
});

app.post('/',upload.single('userFile'), function(req, res) {
  var htmlBody = req.body;
  console.log("body : ", htmlBody.langsel ) ;
  selectedlang =htmlBody.langsel;
  let wav = new WaveFile(fs.readFileSync("./public/uploads/audio.wav"));
  wav.toSampleRate(16000);
  fs.writeFileSync("./public/uploads/16000Hz-file.wav", wav.toBuffer());
  var filename ="./public/uploads/16000Hz-file.wav"; // 16000 Hz, Mono
  var pushStream = sdk.AudioInputStream.createPushStream();
  fs.createReadStream(filename).on('data', function(arrayBuffer) {
    pushStream.write(arrayBuffer.slice());
  }).on('end', function() {
    pushStream.close();
  });
  console.log("Now recognizing from: " + filename);
  var audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
  var speechConfig = sdk.SpeechConfig.fromSubscription(subscriptionKey, serviceRegion);
  speechConfig.enableDictation();
  speechConfig.speechRecognitionLanguage = selectedlang;
  var recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  processmsg =".";
  recognizer.recognizing = (s, e) => {
    processmsg = processmsg + ".";
    console.log("processing ."+processmsg);
};
var outputmsg="" ;
recognizer.recognized = (s, e) => {
   outputmsg =outputmsg + e.result.text;
    console.log("Output : ",outputmsg);
    if (e.result.reason == ResultReason.RecognizedSpeech) {
        console.log(`RECOGNIZED: Text=${e.result.text}`);
    }
    else if (e.result.reason == ResultReason.NoMatch) {
        console.log("NOMATCH: Speech could not be recognized.");
    }
};
recognizer.sessionStopped = (s, e) => {
    console.log("\n    Session stopped event.");
    console.log("Final Output : ",outputmsg);
    fs.writeFileSync("./public/uploads/output.docx", outputmsg);
    console.log("write file");
     res.render(__dirname + "/views/index.html", {data: {status:"completed", contents: outputmsg}});
    console.log("Send status into html");
    recognizer.stopContinuousRecognitionAsync();
};
recognizer.startContinuousRecognitionAsync();
});

//// Server Activation
app.use("*", function (req, res) {
    res.sendFile(path1 + "404.html");
});
app.listen(port, function () {
    console.log(`Example app listening on port localhost: ${port} `);
});