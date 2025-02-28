const eventSource = new EventSource(`/scipts/watcher.php?model=${model}&run=${run1/1000}`);

eventSource.onmessage = function (event) {
    const data = JSON.parse(event.data);

    if (data.run) {
        console.log("New run detected:", data.run);
    }

    if (data.forecast) {
        console.log("New forecast file:", data.forecast);
        downloadNewFile(data.forecast);
    }
};
eventSource.onerror = function () {
    console.error("SSE connection lost");
    setTimeout(() => startEventWatcher(model, run), 5000); // Retry after 5 seconds
};

async function downloadNewFile(filename){
        const { img, sizeInKB } = await loadImage(filename);
        const { rgbArray, canvas } = await convertToCanvasAsync(img, sizeInKB } = await loadImage(imgSrc);
    if (!stopLoadingImages) {
        canvasList.push(canvas);
        rgbArrayList.push(rgbArray);
    }

    // Update the main canvas if this is the first image
    slider.dispatchEvent(new Event("input"));
    updateSliderUI()
};