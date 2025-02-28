var eventSource;
function newEventWatcher() {
    eventSource = new EventSource(`/scripts/eventWatcher.php?model=${model}&run=${run1 / 1000}&variable=${variable}&level=${level}`);
}

newEventWatcher();

eventSource.onmessage = function (event) {
    const eventData = JSON.parse(event.data);

    if (eventData.run) {
        console.log("New run detected:", eventData.run);
    }

    if (eventData.forecast) {
        console.log("New forecast file:", eventData.forecast);
        canvasIndex = parseInt(eventData.forecast.file.split(".")[1]) //gets index of weather model image from filename
        downloadNewFile(`/downloads/${model}/${run1 / 1000}/${eventData.forecast.file}`, canvasIndex);
        data.files.push(eventData.forecast);
    }
};
eventSource.onerror = function () {
    console.error("SSE connection lost");
    setTimeout(() => {
        newEventWatcher();
    }, 5000);
};

async function downloadNewFile(filename,canvasIndex){
    const { img, sizeInKB } = await loadImage(filename);
    const { rgbArray, canvas } = await convertToCanvasAsync(img, sizeInKB);
    if (!stopLoadingImages) {
        canvasList[canvasIndex] = canvas;
        rgbArrayList[canvasIndex] = rgbArray;
    }

    // Update the main canvas if this is the first image
    slider.dispatchEvent(new Event("input"));
    updateSliderUI();
    sliderMaxAvailable = data.files.length - 1;
};