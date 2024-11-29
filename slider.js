const slider = document.getElementById('range-slider');
const fillLeft = document.querySelector('.fill-left');
const unavailableRectangle = document.querySelector('.unavailable-rectangle');
const sliderContainer = document.querySelector('.slider-container');

// Customizable start value for the red rectangle
let unavailableStartValue = 27;

function updateSliderUI() {
    const sliderValue = parseInt(slider.value);
    const min = parseInt(slider.min);
    const max = parseInt(slider.max);

    const sliderWidth = sliderContainer.offsetWidth;

    // Calculate percentages
    const leftPercent = ((sliderValue - min) / (max - min)) * 100;
    const unavailablePercent = ((unavailableStartValue - min) / (max - min)) * 100;

    // Update blue fill
    fillLeft.style.width = `${leftPercent}%`;

    // Update red rectangle
    unavailableRectangle.style.left = `${unavailablePercent}%`;
    unavailableRectangle.style.width = `${100 - unavailablePercent}%`;
}

// Initialize the slider and attach event listener
slider.addEventListener('input', () => {
    const maxValue = unavailableStartValue; // Block slider at redStartValue
    if (slider.value > maxValue) {
        slider.value = maxValue;
    }
    updateSliderUI();
});
updateSliderUI();