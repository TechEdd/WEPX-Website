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
const slider = document.getElementById('range-slider');
const fillLeft = document.querySelector('.fill-left');
const unavailableRectangle = document.querySelector('.unavailable-rectangle');
const sliderContainer = document.querySelector('.slider-container');


function updateSliderUI() {
    const sliderValue = parseInt(slider.value);
    const min = parseInt(slider.min);
    if (model == "HRRR") {
        if ([0, 6, 12, 18].includes(runNb)) {
            slider.max = 48;
        } else {
            slider.max = 18;
        }
    } else { slider.max = 0 };
    const max = parseInt(slider.max);
    const sliderWidth = sliderContainer.offsetWidth;

    // Calculate percentages
    const leftPercent = ((sliderValue - min) / (max - min)) * 100;
    const unavailablePercent = ((data["files"].length - 1 - min) / (max - min)) * 100;

    // Update blue fill
    fillLeft.style.width = `${leftPercent}%`;

    // Update unavailable rectangle
    unavailableRectangle.style.left = `${unavailablePercent}%`;
    unavailableRectangle.style.width = `${100 - unavailablePercent}%`;
}

// Initialize the slider and attach event listener
slider.addEventListener('input', () => {
    const maxValue = data["files"].length - 1; // Block slider at redStartValue
    if (slider.value > maxValue) {
        slider.value = maxValue;
    }
    updateSliderUI();
});
updateSliderUI();