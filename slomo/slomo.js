/* jshint browser: true */

// Helpers
function escape(s) {
    if (typeof s !== 'string') {
        return s;
    }
    return s.replace(/</g, '&lt;').replace(/&/g, '&amp;').replace(/>/g, '&gt;');
}

// Minimal templating engine ;-)
// escaped/unescaped variables, function helpers, loops.
function mustache(template, param) {
    // {{{ variables }}} isolées à ne pas escaper.
    template = template.replace(/{{{\s*([^\s{}]+)\s*}}}/g, function(match, key, offset, string) {
        var replacement = param[key];
        return (replacement !== undefined) ? replacement : '';
    });
    // {{ variables }} isolées qui restent
    template = template.replace(/{{\s*([^\s{}]+)\s*}}/g, function(match, key, offset, string) {
        var replacement = param[key];
        return (replacement !== undefined) ? escape(replacement) : '';
    });
    return template;
}

function hms(duration, ms) {
    if (!ms) duration = duration | 0;
    var s = duration % 60;
    var m = (duration = (duration - s) / 60) % 60;
    var h = (duration - m) / 60;
    // Round to the ms, only at display time.
    var d = Math.round(s * 1000) / 1000;
    if (s < 10) d = '0' + d;
    d = m + ':' + d;
    if (h > 0) {
        if (m < 10) d = '0' + d;
        d = h + ':' + m;
    }
    return d;
}


// Caching DOM requests.
var fileInput = document.getElementById('file-input');

var metadataTpl = document.getElementById('metadata-template').textContent;
var metadataContainer = document.getElementsByClassName('float-aside')[0];
var videoElement = document.getElementsByTagName('video')[0];

var timeDisplayS = document.getElementById('current-s');
var timeDisplayMS = document.getElementById('current-ms');
var playbackRateInput = document.getElementById('playback-rate-input');
var playbackRateOutput = document.getElementById('playback-rate-output');
var timeControls = document.getElementById('time-controls');
var screenControls = document.getElementById('screen-controls');
var screenshots = document.getElementById('screenshots');

var currentURL, currentFileName;
var playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.5, 2];


// Open, Drag and Drop
function handleFiles(files) {
    if (!files.length) return;
    if (currentURL) URL.revokeObjectURL(currentURL);
    currentFileName = files[0].name;
    currentURL = URL.createObjectURL(files[0]);
    videoElement.src = currentURL;
}

function dropFiles(files) {
    // Putting a real file name here fires a Security Error.
    fileInput.value = '';
    handleFiles(files);
}

(function(droptarget, fileCallback) {
    droptarget.addEventListener("dragenter", dragenter, false);
    droptarget.addEventListener("dragleave", dragleave, false);
    droptarget.addEventListener("dragover", dragover, false);
    droptarget.addEventListener("drop", drop, false);

    function dragenter(e) {
        e.stopPropagation();
        e.preventDefault();
        document.body.classList.add('dragging');
    }

    function dragleave(e) {
        e.stopPropagation();
        e.preventDefault();
        if (e.target === document.documentElement) document.body.classList.remove('dragging');
    }

    function dragover(e) {
        e.stopPropagation();
        e.preventDefault();
    }

    function drop(e) {
        e.stopPropagation();
        e.preventDefault();
        document.body.classList.remove('dragging');

        var dt = e.dataTransfer;
        var files = dt.files;

        if (files.length) fileCallback(files);
    }
}(window, dropFiles));     //document.getElementById("droptarget");


// View
function updateMetadata() {
    var ratio = videoElement.videoWidth / videoElement.videoHeight;
    var ar;
    switch (ratio) {
        case 4/3: ar = '4:3'; break;
        case 16/9: ar = '16:9'; break;
        case 21/9: ar = '21:9'; break;
        default: ar = 'non standard';
    }
    metadataContainer.innerHTML = mustache(metadataTpl, {
        filename: currentFileName,
        duration: hms(videoElement.duration, true),
        videoWidth: videoElement.videoWidth,
        videoHeight: videoElement.videoHeight,
        ar: ar
    });
}

function toBaseSize() {
    videoElement.style.height = '500px';
    videoElement.style.width = videoElement.videoWidth * 500 / videoElement.videoHeight + 'px';
}

function toNaturalSize() {
    videoElement.style.height = videoElement.videoHeight + 'px';
    videoElement.style.width = videoElement.videoWidth + 'px';
}

// Video metadata must be available
function resetPlayer() {
    document.body.classList.remove('animate');
    toBaseSize();
    updateMetadata();
    playbackRateInput.value = playbackSpeeds.indexOf(1);
    playbackRateOutput.value = 1;
    videoElement.playbackRate = 1;
    document.body.classList.add('animate');
}

function updateSpeed(e) {
    var inputSpeed = playbackSpeeds[e.target.valueAsNumber];
    if (inputSpeed !== videoElement.playbackRate) {
        videoElement.playbackRate = inputSpeed;
    }    
    var actualSpeed = videoElement.playbackRate;
    playbackRateInput.value = playbackSpeeds.indexOf(actualSpeed);
    playbackRateOutput.value = actualSpeed;
}


// Canvas - screenshot
// "Save as" doesn't allow to preset a filename. Doing this would involve a <a download="filename.png">
// and a canvas.toDataURL in some way. Too big for data urls. Too complicated. Not right-click friendly.
function screenshot(video) {
    var canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    var context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
    return canvas;
}

function addScreenshot() {
    var canvas = screenshot(videoElement);
    var height = 150;
    canvas.title = currentFileName + ', time ' + hms(videoElement.currentTime) + ', ' + videoElement.videoWidth + '×' + videoElement.videoHeight + ' pixels';
    canvas.style.width = videoElement.videoWidth * height / videoElement.videoHeight + 'px';
    canvas.style.height = height + 'px';
    screenshots.appendChild(canvas);
    screenshots.style.display = 'block';
}


// Control panel
function controlClick(event) {
    if (event.target === timeControls || event.target === screenControls) return;
    var target = event.target;
    while (target.nodeName !== 'LI') target = target.parentNode;
    switch (target.getAttribute('data-action')) {
        case 'start': videoElement.pause(); videoElement.currentTime = 0; break;
        case 'previous30': videoElement.pause(); videoElement.currentTime -= 1/30; break;
        case 'previous1': videoElement.pause(); videoElement.currentTime -= 1; break;
        case 'next1': videoElement.pause(); videoElement.currentTime += 1; break;
        case 'next30': videoElement.pause(); videoElement.currentTime += 1/30; break;
        case 'end': videoElement.pause(); videoElement.currentTime = videoElement.duration; break;
        case 'screenshot': addScreenshot(); break;
        case 'resize':
            if (target.title === 'natural size') {
                toNaturalSize();
                target.title = 'standard size';
                target.firstElementChild.className = 'icon-shrink2';
            }
            else {
                toBaseSize();
                target.title = 'natural size';
                target.firstElementChild.className = 'icon-enlarge2';
            }
            break;
        default: window.alert(target.getAttribute('data-action') + ' is not implemented yet');
    }
}

function displayTime() {
    var t = videoElement.currentTime;
    timeDisplayS.textContent = hms(t);
    var ms = '' + (t % 1 * 1000 + 0.5 | 0);
    timeDisplayMS.textContent = '.' + '0'.repeat(3 - ms.length) + ms;
}



// Init

videoElement.addEventListener('loadedmetadata', resetPlayer);
videoElement.addEventListener('timeupdate', displayTime);
// load initial video after setting the listeners
// http://www.hd-trailers.net/movie/jurassic-world/ doesn't work (plays well, but setting currentTime or playbackRate has no effect if paused)
videoElement.src = currentFileName = 'broadcast1.mp4';

playbackRateInput.max = playbackSpeeds.length - 1;
playbackRateInput.addEventListener('input', updateSpeed);
playbackRateInput.addEventListener('change', updateSpeed);
timeControls.addEventListener('click', controlClick, true);
screenControls.addEventListener('click', controlClick, true);
