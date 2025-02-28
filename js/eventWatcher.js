var eventSource = new EventSource(`/scripts/eventWatcher.php?model=${model}&run=${run1/1000}&variable=${variable}&level=${level}`);

eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);

    if (data.run) {
        console.log("New run detected:", data.run);
    }

    if (data.forecast) {
        console.log("New forecast file:", data.forecast.file);
        downloadNewFile(`/downloads/${model}/${run1 / 1000}/${data.forecast.file}`);
        data.files.push(data.forecast);
    }
};
eventSource.onerror = function () {
    console.error("SSE connection lost");
    setTimeout(() => {
        eventSource = new EventSource(`/scripts/eventWatcher.php?model=${model}&run=${run1 / 1000}&variable=${variable}&level=${level}`);
    }, 5000);
};

async function downloadNewFile(filename){
    const { img, sizeInKB } = await loadImage(filename);
    const { rgbArray, canvas } = await convertToCanvasAsync(img, sizeInKB);
    if (!stopLoadingImages) {
        canvasList.push(canvas);
        rgbArrayList.push(rgbArray);
    }

    // Update the main canvas if this is the first image
    slider.dispatchEvent(new Event("input"));
    updateSliderUI()
};