// dropdownmenu
// Function to toggle dropdown visibility
function toggleDropdown(id) {
	var element = document.getElementById(id);
	element.classList.toggle('open');
	if (element.style.display === "block") {
	  element.style.display = "none";
	} else {
	  element.style.display = "block";
	}
}

// Function to toggle dropdown visibility
function toggleDropdown(id) {
    var element = document.getElementById(id);
    element.classList.toggle('open');
    if (element.style.display === "block") {
      element.style.display = "none";
    } else {
      element.style.display = "block";
    }
}


// slider
const fillLeft = document.querySelector('.fill-left');
const availableSlider = document.querySelector('.available');
const unavailableRectangle = document.querySelector('.unavailable-rectangle');
const sliderContainer = document.querySelector('.slider-container');

let isPlaying = false; // Play/Pause state
let playInterval; // Reference for the interval

// Create the play/pause button
const playPauseButton = document.getElementById('animateButton');

// Handle button click
playPauseButton.addEventListener('click', () => {
    isPlaying = !isPlaying;

    // Toggle icons
    playPauseButton.querySelector('.play-icon').style.display = isPlaying ? 'none' : 'block';
    playPauseButton.querySelector('.pause-icon').style.display = isPlaying ? 'block' : 'none';

    if (isPlaying) {
        const delay = 500; // Set delay in milliseconds
        const maxValue = data["files"].length - 1;

        playInterval = setInterval(() => {
			const maxValue = data["files"].length - 1; // Maximum slider value
			const minValue = 0; // Minimum slider value

			if (slider.value < maxValue) {
				slider.value++;
			} else {
				slider.value = minValue; // Reset to the minimum value
			}

			slider.dispatchEvent(new Event('input')); // Trigger slider input event
		}, delay);
    } else {
        stopPlaying(); // Stop the interval
    }
});

// Stop playing and reset the state
function stopPlaying() {
    clearInterval(playInterval);
    isPlaying = false;
    playPauseButton.querySelector('.play-icon').style.display = 'block';
    playPauseButton.querySelector('.pause-icon').style.display = 'none';
}


function updateSliderUI() {
    const sliderValue = parseInt(slider.value);
    const min = parseInt(slider.min);
    if (model == "HRRR") {
        if ([0, 6, 12, 18].includes(runNb)) {
            slider.max = 48;
        } else {
            slider.max = 18;
        }
    } else if (model == "HRRRSH"){
		slider.max = 18*4;
    } else if (model == "NAMNEST") {
        slider.max = 60;
    }

	else { slider.max = 0 };
    const max = parseInt(slider.max);
    const sliderWidth = sliderContainer.offsetWidth;

    // Calculate percentages
    const leftPercent = ((sliderValue - min) / (max - min)) * 100;
    var unavailablePercent = ((data["files"].length - 1 - min) / (max - min)) * 100;

    // Update blue fill
    fillLeft.style.width = `${leftPercent}%`;

    // Update unavailable rectangle
    unavailableRectangle.style.left = `${unavailablePercent}%`;
    unavailableRectangle.style.width = `${100 - unavailablePercent}%`;
}

function epochToTimestamp(epoch) {
	const date = new Date(epoch * 1000); // Convert epoch to milliseconds
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-indexed
	const day = String(date.getDate()).padStart(2, '0');
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// Initialize the slider and attach event listener
let sliderMaxAvailable = 1;
slider.addEventListener('input', () => {
    
    if (slider.value > sliderMaxAvailable) {
        slider.value = sliderMaxAvailable;
    } else if (slider.value < 0){
		slider.value = 0;
	}
    updateSliderUI();
    
	//temporarily stopping dragging preventing resetting
	if(zoomMode=="map"){
		isDragging = false; 
		updateContainerTransform();
	}
	
	//change canvas
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    canvas.getContext('2d').drawImage(canvasList[slider.value], 0, 0, canvas.width, canvas.height);
    determineDistance(canvasList[slider.value]);
    forecastTimeText.innerHTML = epochToTimestamp(data["files"][slider.value]["forecastTime"]);
	if(zoomMode=="map"){
		if(isLeftPressed){
			isDragging = true;
		}
	}
});
updateSliderUI();

function updateUrlVariable(variableName, variableValue, levelName, levelValue) {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    // Update or add the variable
    params.set(variableName, variableValue);
    if (levelName != undefined) {
        params.set(levelName, levelValue);
    }

    // Update the browser's history without refreshing the page
    window.history.replaceState({}, '', `${url.pathname}?${params.toString()}`);
}

function reloadImagesPrepare(){
	//break the current image loading
	if (!allImagesLoaded){
		stopLoadingImages = true;
    }
    document.getElementById("runSelect").innerHTML = "Run: " + new Date(parseInt(run1)).toISOString().replace('T', ' ').slice(0, 16) + 'z';
    availableSlider.style.opacity = 1;
    fetchFile(`getRuns.php?model=${model}&run=${run1/1000}`).then(listOfRuns => {
        document.getElementById('dropdownRun').innerHTML = listOfRuns;
    })
    fetchFile(`${model}menu.html`).then(paramMenu => {
        document.getElementById("parametersMenu").innerHTML = paramMenu;
    })
    reloadImages();
    
    
}