

// Plugin to show an image and record audio while user pronounces the word
// requires some functions from "audio-recording.js"

jsPsych.plugins['picture-naming'] = (function(){

    jsPsych.pluginAPI.registerPreload('picture-naming', 'stimulus', 'image');

    var txt = {
        btnStopRecording: 'Opname stoppen', // Stop recording
        btnContinue: 'Verdergaan', // Continue
        titleInstruction: 'Op welke waarde schat je dit object?', //'What price do you think is this item valued at?',
        statusInitializing: 'Initialeseren', //'Initialising',
        statusRecording: 'Aan het opnemen...', // Recording...
        statusStoppingRecording: 'Even geduld alsjeblieft', // Please wait
        statusUploading: 'Opslaan', // Save
        statusDone: 'Klaar', // Done
    }

    var maxRecordingTime = 30000; // Maximum recording length in ms
    var stopRecordingDelay = 1000; // After user presses done, keep recording for this many ms

    var plugin = {};

    plugin.info = {
        name: 'picture-naming',
        parameters: {
            imgFilename: {
                type: jsPsych.plugins.parameterType.IMAGE, // BOOL, STRING, INT, FLOAT, FUNCTION, KEYCODE, SELECT, HTML_STRING, IMAGE, AUDIO, VIDEO, OBJECT, COMPLEX
                default: undefined,
                pretty_name: 'Image filename',
                description: 'Filename of the image to be displayed (no path)'
            },
            imgDir: {
                type: jsPsych.plugins.parameterType.STRING,
                default: "",
                pretty_name: 'Image dir',
                description: 'Directory where images are stored, relative to main html file'
            },
            imgIndex: {
                type: jsPsych.plugins.parameterType.INT,
                default: 0,
                pretty_name: 'Image index',
                description: 'Number that uniquely identifies the image, used to show progress (4/100) and for saving data'
            },
            lastImgIndex: {
                type: jsPsych.plugins.parameterType.INT,
                default: 0,
                pretty_name: 'Last image index',
                description: 'Number of the last image (used to show progress: 4/100)'
            },
            ppn: {
                type: jsPsych.plugins.parameterType.INT,
                default: 1,
                pretty_name: 'Proefpersoon nummer',
                description: 'Participant number, used for saving data'
            },
        }
    }

    plugin.trial = function(display_element, trial){
        console.log("Starting trial: ", trial);

        var data = {
            ppn: trial.ppn,
            imgFilename: trial.imgFilename,
            imgIndex: trial.imgIndex,
            timeShow: null,
            timeStartRec: null,
            timeStopRec: null,
            timeStartUpload: null,
            timeStopUpload: null,
            timeContinue: null,
        };

        // function to end trial when it is time
        var endTrial = function() {
            // kill any remaining setTimeout handlers
            jsPsych.pluginAPI.clearAllTimeouts();
            // clear the display
            display_element.innerHTML = '';
            // move on to the next trial
            jsPsych.finishTrial(data);
        };

        var uploadAudioFile = function(blob) {
            var onProgress = function(percentage) {
                progress.attr('value', Math.round(percentage*100));
            }
            var onDone = function(serverResponse) {
                // Done uploading, allow user to continue
                status.html(txt.statusDone);
                progress.attr('value', 100);
                btnContinue.prop('disabled', false);
                data.timeStopUpload = Date.now();
            }
            var onError = function(err) {
                // Audio file could not be uploaded
                // Show alert and keep continue button disabled
                status.html("Error uploading audio: "+err);
                alert("Error uploading audio: '"+err+"'. Do you have a stable internet connection?\nPlease restart the experiment or contact the experimenter.")
            }

            status.html(txt.statusUploading);
            progress.attr('value', 0);

            data.timeStartUpload = Date.now();
            var date = new Date();
            var datestr = date.getFullYear() + "-" + ("0" + (date.getMonth() + 1)).slice(-2) + "-" + ("0" + date.getDate()).slice(-2) + "_" + ("0" + date.getHours()).slice(-2) + "-" + ("0" + date.getMinutes()).slice(-2) + "-" + ("0" + date.getSeconds()).slice(-2);
            var filename = "ppn" + trial.ppn + "_pretest_stim" + trial.imgIndex + "_time" + datestr;
            uploadAudio(blob, filename, onProgress, onDone, onError);
        }

        var handleDoneClick = function() {
            if (data.timeStopRec === null) {
                // Stop recording and then start uploading
                data.timeStopRec = Date.now();

                status.html(txt.statusStoppingRecording)
                btnDone.prop('disabled', true);
                btnContinue.prop('disabled', true);

                jsPsych.pluginAPI.setTimeout(function() {
                    recorder.stopRecording(function() {
                        var blob = recorder.getBlob();
                        uploadAudioFile(blob);
                    });
                }, stopRecordingDelay);
            }
        }

        var handleContinueClick = function() {
            if (data.timeContinue === null) {
                data.timeContinue = Date.now();

                btnDone.prop('disabled', true);
                btnContinue.prop('disabled', true);

                endTrial();
            }
        }

        var container = $(
            '<div id="naming">'+
                '<div id="instruction"></div>'+
                '<div id="stimulus-container">'+
                    '<img id="stimulus" src="" />'+
                '</div>'+
                '<div id="status"></div>'+
                '<progress id="progress" value="0" max="100"></progress>'+
                '<div id="controls">'+
                    '<button id="btn-done" class="jspsych-btn">'+txt.btnStopRecording+'</button>'+
                    '<button id="btn-continue" class="jspsych-btn">'+txt.btnContinue+'</button>'+
                '</div>'+
            '</div>'
        );

        var instruction = container.find('#instruction');
        var btnDone = container.find('#btn-done');
        var btnContinue = container.find('#btn-continue');
        var img = container.find('#stimulus');
        var status = container.find('#status');
        var progress = container.find('#progress');

        // Clear the display and add the container
        display_element.innerHTML = '';
        container.appendTo(display_element);

        // Set instruction and image
        instruction.html((trial.imgIndex+1) + "/" + (trial.lastImgIndex+1) + "<br>" + txt.titleInstruction);
        img.attr('src', trial.imgDir+"/"+trial.imgFilename);
        data.timeShow = Date.now();

        // Initialize buttons and status
        status.html(txt.statusInitializing);
        btnDone.prop('disabled', true);
        btnContinue.prop('disabled', true);
        btnDone.on('click', handleDoneClick);
        btnContinue.on('click', handleContinueClick);

        // Get recording and when found, start recording
        var recorder = null;
        getRecorder(function(rec) {
            data.timeStartRec = Date.now();
            recorder = rec;
            recorder.startRecording();
            status.html(txt.statusRecording);
            btnDone.prop('disabled', false);
            progress.attr('value', null); // Set progress to indeterminate

            // After a max time, stop recording
            jsPsych.pluginAPI.setTimeout(function() {
                if (!btnDone.prop('disabled')) {
                    btnDone.click();
                }
            }, maxRecordingTime);
        });

    }

    return plugin;

})();


// Define helper functions

// Note: returns array of numbers, not strings
function getCompletedImages() {
    var str = localStorage.getItem("completedImages");
    if (str == null) {
        return [];
    } else {
        var arr = str.split(",");
        arr = arr.map(function(val) { return parseInt(val); });
        return arr;
    }
}

function addCompletedImage(imgIndex) {
    var arr = getCompletedImages();
    arr.push(imgIndex);
    var str = arr.join(",");
    localStorage.setItem("completedImages", str);
}

// Note: imgIndex must be a number, not a string
function isImageCompleted(imgIndex) {
    var completedNrs = getCompletedImages();
    if (completedNrs.indexOf(imgIndex) === -1) {
        return false;
    } else {
        return true;
    }
}

function resetCompletedImages() {
    localStorage.removeItem("completedImages");
}

function selectImages(images, isPractice, skipCompleted) {
    // Practice trials use the first 4 images, real trials use the rest
    if (isPractice) {
        images = images.slice(0, 0);
    } else {
        images = images.slice(0);
    }

    // Remove images that were already seen if needed (stored in localStorage)
    return images.filter(function(img) {
        if (skipCompleted && isImageCompleted(img.index)) {
            return false;
        } else {
            return true;
        }
    });
}

function makeTrialsFromImages(images, lastImgIndex, imgDir, ppn) {
    var timeline = [];
    for (var i=0; i<images.length; i++) {
        var img = images[i];
        timeline.push({
            type: 'picture-naming',
            imgFilename: img.filename,
            imgIndex: img.index,
            lastImgIndex: lastImgIndex,
            imgDir: imgDir,
            ppn: ppn,
        });
    }
    return timeline;
}

function saveData(data, ppn) {
    var filename  = ppn + "_pretest.dat" // server adds datetime
    var jsonData = JSON.stringify(data);
	$.ajax({
		type: 'POST',
		url: 'save_data.php',
        data: {
            filename: filename,
            data: jsonData
        },
		success: function(output) {
            // For picture-naming tasks, store img index in local storage so it can be skipped on page reload
            if (data.trial_type == 'picture-naming') {
                addCompletedImage(data.imgIndex);
            }
		}
	});
}

// Initialize global variables

// Get participant number from URL query string
var ppn = jsPsych.data.urlVariables()['ppn']
if (ppn === undefined) {
    ppn = 1
}

// Check if pictureList is loaded from JS file
if (typeof pictureList === 'undefined') {
    var err = new Error("Picture list not loaded, try a page refresh or contact the experimenter");
    alert(err);
    throw err; // die if we don't have the pictures
}

// Directory where images are located (relative to naming.html)
var imgDir = "resources";


// Make instruction trials
var recordTestPrompt = {
	type: "call-function",
	func: function(){
        // Make and send a 1 second recording
        // mainly to show a prompt in browser asking for permission to record
        recordTime(1, ppn+"_audio-test");

        // Send some data about the browser
        var initialData = {
            time: (new Date()).toString(),
            userAgent: navigator.userAgent,
            screenWidth: screen.width,
            screenHeight: screen.height,
            windowWidth: $(window).width(),
            windowHeight: $(window).height(),
        };
        saveData(initialData, ppn);
    },
}

var experimentInstructions = {
  type: 'instructions',
  pages: [
    '<p><b>Welkom!</b></p>' +
    '<p>Beste proefpersoon, van harte bedankt voor je deelname aan dit experiment. Het is een studie over de subjectieve waarde van voorwerpen en de stabiliteit ervan. Je zult in verschillende taken prijsschattingen maken en prijsvergelijkingen maken of beluisteren. Het experiment wordt in het Engels gedaan, ten eerste om de studie met mensen met verschillende moedertalen te kunnen uitvoeren, en ten tweede omdat niet alle betrokken onderzoekers Nederlanders praten.</p>',

    '<p><b>Technische Informaties</b></p>' +
    '<p>In dit experiment zullen audio-opnames gemaakt worden van jouw antwoorden. Als je gevraagd wordt om toestemming te geven voor het gebruik van de microfoon van je computer, klik dan alsjeblieft op “Allow” en “Remember this decision”. Dankjewel!</p>' +
    '<p>Als je tijdens het experiment technische problemen hebt (als je bijvoorbeeld plotseling geen verbinding hebt met het internet of als je browser vastloopt), open het experiment dan opnieuw in dezelfde browser. Het experiment laat de instructies dan opnieuw zien en gaat door met de taak waar je gebleven was. Als je andere problemen hebt, neem dan contact op met de onderzoekers.</p>'
  ],
  show_clickable_nav: true,
  button_label_next: "Verdergaan",
  button_label_previous: "Vorige",
}

var generalInstructions = {
    type: 'instructions',
    pages: [
      '<p><b>Taak 1 uit 3</b></p>' +
      '<p>Je gaat nu beginnen aan de eerste taak van het onderzoek.</p>' +
      '<p>In deze taak is het de bedoeling dat je voor verschillende objecten op afbeeldingen een prijsschatting doet in het Engels. B.v. zie je een afbeelding van een roos dan zou je kunnen zeggen: “A rose costs 1 Euro”. Als je het Engelse woord voor het object niet kent, probeer het dan alsnog met andere woorden te omschrijven. Er is geen goed of fout antwoord, we zijn puur in je subjectieve inschattingen geïnteresseerd. Probeer de door jou genoemde prijzen te onthouden voor de volgende taken.</p>',
      '<p>Een audio-opname van jouw antwoord zal automatisch gemaakt worden zodra het object getoond wordt. Je krijgt een maximum van dertig seconden per object. Na het geven van je antwoord, klik dan op "Opname stoppen”.</p>' +
      '<p>Nadat de opname is opgeslagen, kun je op "Verdergaan" klikken om het volgende object te zien te krijgen. Mocht je behoefte hebben aan een korte pauze, doe dit dan voordat je op "Verdergaan" klikt.</p>',
      '<p>De taak zal nu beginnen.</p>'
      /*'<p><b>Welcome to the experiment!</p></b>' +
      '<p>In the following experiment, audio recordings will have to be made of your responses. To make sure things run smoothly, please grant this website access to your microphone.</p><p>To do so, please choose "Allow" and "Remember this decision" when prompted. Thank you!</p>' +
      '<p>Should you encounter technical difficulties during the experiment (such as your browser freezing or network cutting out), please open <b>the same browser</b> and refresh this page. The experiment should, after displaying the instructions again, continue wherever you left off. Should there be any persistent problems, please get in touch with the researchers.</p>',
      '<p><b>Task 1 of 3: Price estimation</b></p>' +
      '<p>In the following task, you will be shown pictures of common objects. Your task will be to make a guess of what you think the item costs.</p>' +
      '<p>Please, name the object and the price in a full sentence (for example, "A table costs fifty euros.").</p>' +
      '<p>An audio recording of your answer will be started automatically as soon as the object is displayed. You will be given a maximum of thirty seconds per object. After speaking the sentence, hit "Stop recording".</p>' +
      '<p>After the recording is saved, you will be able to click "Next" to see the next object. Should you ever want to take a break, please do so before clicking "Next".</p>',
      '<p>Ready?</p>'*/
    ],
    show_clickable_nav: true,
    button_label_next: "Verdergaan",
    button_label_previous: "Vorige",
}

var practiceTrialsInstruction = {
	type: "html-button-response",
    stimulus:
        '<p>The following four objects are practice trials so you can get a feeling for the task.</p>'+
        '<p>Hit "Next" to start.</p>',
	choices: ["Next"],
}

var realTrialsInstruction = {
	type: "html-button-response",
    stimulus:
        '<p>The task will now commence.</p>'+
        '<p>Again, hit "Stop recording" <b>after</b> speaking your sentence, followed by "Next" whenever you are ready for the next object.</p>',
	choices: ["Next"],
}

// find stimulus list for next task
var list_number = jsPsych.data.urlVariables()['list'];
if (list_number === undefined) {
  list_number = 0;
}

// For debugging to reset localStorage, add ?reset=1 to url:
if (jsPsych.data.urlVariables()['reset']) {
    resetCompletedImages();
    document.location.replace("experiment.html?ppn="+ppn+"&list="+list_number)
}

var thanks = {
	type: "html-button-response",
    //stimulus: '<p>You have completed task one!<br><br><a href="experiment2.html?ppn=' + ppn + '&list=' + list_number + '">Please, click here to proceed with the second task.</a></p>',
    stimulus: '<p>Je bent nu klaar met de eerste taak! Neem even een korte pauze.<br><br><a href="experiment2.html?ppn=' + ppn + '&list=' + list_number + '">Wanneer je er klaar voor bent, kun je hier klikken om door te gaan met de tweede taak.</a></p>',
    choices: [],
}

// Make image-naming trials
var images = pictureList.map(function(filename, index) {
    return {
        filename: filename,
        index: index,
    }
})

var lastImageIndex = images[images.length-1].index;

var practiceImages = selectImages(images, true, true);
var practiceTrials = makeTrialsFromImages(practiceImages, lastImageIndex, imgDir, ppn);

var realImages = selectImages(images, false, true);
var realTrials = makeTrialsFromImages(realImages, lastImageIndex, imgDir, ppn);


// Make timeline
var timeline = [];
if (practiceTrials.length > 0 || realTrials.length > 0) {
    timeline = timeline.concat(experimentInstructions, recordTestPrompt, generalInstructions);
}
if (practiceTrials.length > 0) {
    timeline = timeline.concat(practiceTrialsInstruction, practiceTrials);
}
if (realTrials.length > 0) {
    if (practiceTrials.length > 0) {
      timeline = timeline.concat(realTrialsInstruction, realTrials);
    } else {
      timeline = timeline.concat(realTrials);
    }
}
timeline = timeline.concat(thanks);


// Make list of images to preload (imgDir/filename)
var allUsedImages = [].concat(practiceImages, realImages);
var preloadImagePaths = allUsedImages.map(function(img) { return imgDir+"/"+img.filename; })

/// Initialize experiment, but only if informed consent has been obtained
if (localStorage.getItem("informedConsentGiven") != "yes") {
  var err = new Error("Je moet aanvankelijk met de informed consent akkord gaan.");
  alert(err);
  document.location.replace("informedconsent.html?ppn="+ppn+"&list="+list_number);
  throw err;
} else {
  jsPsych.init({
      timeline: timeline,
      on_data_update: function(data) { saveData(data, ppn); }, // Called after each trial with trialdata in argument
      preload_images: preloadImagePaths,
  });
}
