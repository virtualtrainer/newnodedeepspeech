// ./src/index.js
const DeepSpeech = require('deepspeech');
const Fs = require('fs');
const Sox = require('sox-stream');
const MemoryStream = require('memory-stream');
const Duplex = require('stream').Duplex;
const Wav = require('node-wav');

let modelPath = './models/deepspeech-0.9.3-models.pbmm';

let model = new DeepSpeech.Model(modelPath);

let desiredSampleRate = model.sampleRate();

let scorerPath = './models/deepspeech-0.9.3-models.scorer';

model.enableExternalScorer(scorerPath);



// importing the dependencies
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

// defining the Express app
const app = express();

// defining an array to work as the database (temporary solution)

// adding Helmet to enhance your API's security
app.use(helmet());

// using bodyParser to parse JSON bodies into JS objects
app.use(bodyParser.json());

const fileUpload = require('express-fileupload');

//const bodyParser = require('body-parser');

// enabling CORS for all requests
app.use(cors());

app.use(bodyParser.urlencoded({extended: true}));

const _ = require('lodash');

// adding morgan to log HTTP requests
app.use(morgan('combined'));

app.use(fileUpload({
    createParentPath: true
}));


// defining an endpoint to return all ads
app.get('/', (req, res) => {
	let audioFile = process.argv[2] || './audio/'+req.query.name;
	if (!Fs.existsSync(audioFile)) {
		console.log('file missing:', audioFile);
		process.exit();
	}
	
	const buffer = Fs.readFileSync(audioFile);
	const result = Wav.decode(buffer);
	
	if (result.sampleRate < desiredSampleRate) {
		console.error('Warning: original sample rate (' + result.sampleRate + ') is lower than ' + desiredSampleRate + 'Hz. Up-sampling might produce erratic speech recognition.');
	}
	
	function bufferToStream(buffer) {
		let stream = new Duplex();
		stream.push(buffer);
		stream.push(null);
		return stream;
	}
	
	let audioStream = new MemoryStream();
	bufferToStream(buffer).
	pipe(Sox({
		global: {
			'no-dither': true,
		},
		output: {
			bits: 16,
			rate: desiredSampleRate,
			channels: 1,
			encoding: 'signed-integer',
			endian: 'little',
			compression: 0.0,
			type: 'raw'
		}
	})).
	pipe(audioStream);
	
	audioStream.on('finish', () => {
		let audioBuffer = audioStream.toBuffer();
		
		const audioLength = (audioBuffer.length / 2) * (1 / desiredSampleRate);
		console.log('audio length', audioLength);
		
		let result = model.stt(audioBuffer);
		
		console.log('result:', result);
		res.send(result);
	});
  
});

app.post('/audio', async (req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            //Use the name of the input field (i.e. "audio") to retrieve the uploaded file
            let audio = req.files.audio;
            
            //Use the mv() method to place the file in upload directory (i.e. "uploads")
            audio.mv('./audio/' + audio.name);

            //send response
            res.send({
                status: true,
                message: 'File is uploaded',
                data: {
                    name: audio.name,
                    mimetype: audio.mimetype,
                    size: audio.size
                }
            });
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

// starting the server
app.listen(process.env.PORT || 3001, () => {
  console.log('listening on port 3001');
});