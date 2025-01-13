const innerContainer = document.getElementById("inner-container");
const container = document.getElementById("container");
const slider = document.getElementById('range-slider');
const canvas = document.getElementById('canvas');
const forecastTimeText = document.getElementById("forecastTime");
let animationFrameId;
let isDragging = false;
let startX = 0, startY = 0;
let cursorX = 0, cursorY = 0;
let imgX = 0, imgY = 0;
let zoomLevel = 1;
let isLeftPressed = false;
const zoomSpeed = 0.2;
const moveSpeed = 10;
// Define the resolution of the main image
const desiredWidth = canvas.width = 3000;
const desiredHeight = canvas.height = 1290;

// Select all images inside the container
const images = document.querySelectorAll('.image');

// Base scale factors for different resolution images (adjust as needed)
const imageScales = {
	'main-image': 1,  // Scale factor for main image
	'attached-image': 1  // Example: attached image is 80% the size of the main image
};

// Prevent default drag and context menu on the container
container.addEventListener('mousedown', (e) => {
	e.preventDefault();
	isDragging = isLeftPressed = true;
	startX = e.clientX - imgX;
	startY = e.clientY - imgY;
	innerContainer.classList.add("dragging");
});

container.addEventListener('mouseup', () => {
	isDragging = isLeftPressed = false;
	innerContainer.classList.remove("dragging");
});

container.addEventListener('mouseleave', () => {
	isDragging = isLeftPressed = false;
	innerContainer.classList.remove("dragging");
	tooltip.style.display = 'none'; // Hide the tooltip
});

container.addEventListener('mousemove', (e) => {
	// Cancel the previous animation frame if one is already scheduled
	if (animationFrameId) {
		cancelAnimationFrame(animationFrameId);
	}
	// Schedule the next animation frame
	animationFrameId = requestAnimationFrame(() => {
		if (isDragging) {
			imgX = e.clientX - startX;
			imgY = e.clientY - startY;
			updateContainerTransform();
		}
	});
	
	cursorX = e.clientX;
	cursorY = e.clientY;

	tooltip.textContent = getPixelValue();
	tooltip.style.left = `${event.pageX - tooltip.offsetWidth / 2}px`; // Center horizontally
	tooltip.style.top = `${event.pageY - 40}px`; // Center vertically
	tooltip.style.display = 'block';             // Make the tooltip visible

});

function getPixelValue(listValue) {
	//not explicitly sent, si checks slider value for image index
	if (listValue==null){
		listValue = slider.value
	}

	//get pixel index
	const rect = canvas.getBoundingClientRect();
	let x = cursorX - rect.left; // X position relative to the canvas
	let y = cursorY - rect.top;  // Y position relative to the canvas
	const zoomingFactorX = canvas.width / rect.width;
	const zoomingFactorY = canvas.height / rect.height;

	//get value of array
	x = parseInt(x * zoomingFactorX);
	y = parseInt(y * zoomingFactorY);
	let value = null;
	//out of range
	if ((x < 0 && x < canvas.width) || (y < 0 && y < canvas.height)) {
		value = null;
	} else {
		value = rgbArrayList[listValue][y * canvas.width + x];
	}
	
	if (value != null || !isNaN(value)) {
		return value?.toFixed(2);
	} else {
		return null;
	};

}

// Handle zoom with W (zoom in) and S (zoom out) keys, move with arrows
document.addEventListener('keydown', (e) => {
	switch (e.key) {
		case 'w': // Zoom in
			zoomContainer(zoomSpeed, cursorX, cursorY);
			break;
		case 's': // Zoom out
			zoomContainer(-zoomSpeed, cursorX, cursorY);
			break;
		case 'ArrowUp': // Move up
			imgY -= moveSpeed;
			break;
		case 'ArrowDown': // Move down
			imgY += moveSpeed;
			break;
		case 'ArrowLeft': // Move left
			slider.value--;
			tooltip.textContent = getPixelValue(slider.value);
			slider.dispatchEvent(new Event("input"));
			break;
		case 'ArrowRight': // Move right
			slider.value++;
			tooltip.textContent = getPixelValue(slider.value);
			slider.dispatchEvent(new Event("input"));
			break;
	}
	updateContainerTransform();
});

// Zoom on mouse wheel
document.addEventListener('wheel', (e) => {
	e.preventDefault();
	const zoomDirection = e.deltaY < 0 ? zoomSpeed : -zoomSpeed;
	zoomContainer(zoomDirection, e.clientX, e.clientY);
}, { passive: false });


// Touch events for drag and pinch-to-zoom
innerContainer.addEventListener('touchstart', (e) => {
	if (e.touches.length === 1) {
		// Single touch (dragging)
		isDragging = true;
		startX = e.touches[0].clientX - imgX;
		startY = e.touches[0].clientY - imgY;
	} else if (e.touches.length === 2) {
		// Pinch to zoom
		isDragging = false;
		initialDistance = getTouchDistance(e);
		initialZoom = zoomLevel;
	}
});

innerContainer.addEventListener('touchmove', (e) => {
	e.preventDefault();
	if (e.touches.length === 1 && isDragging) {
		// Single touch drag
		imgX = e.touches[0].clientX - startX;
		imgY = e.touches[0].clientY - startY;
		updateContainerTransform();
	} else if (e.touches.length === 2) {
		// Pinch to zoom
		const currentDistance = getTouchDistance(e);
		const zoomAmount = (currentDistance / initialDistance - 1) * zoomSpeed;
		zoomLevel = Math.max(initialZoom + zoomAmount, 0.3);
		updateContainerTransform();
	}

});

innerContainer.addEventListener('touchend', () => {
	isDragging = false;
});


async function zoomContainer(zoomAmount, mouseX, mouseY) {
	const prevZoomLevel = zoomLevel;
	if (zoomLevel < 1) {
		zoomAmount = zoomAmount / 4; //slower on unzoom
	}
	zoomLevel = Math.max(zoomLevel + zoomAmount, 0.3); // Prevent zooming out too far

	const mouseXRel = mouseX; // Mouse position relative to the container
	const mouseYRel = mouseY;


	// Calculate the scaling factor
	const zoomFactor = zoomLevel / prevZoomLevel;

	// Adjust imgX and imgY so that the zoom centers on the mouse position
	imgX = mouseXRel - zoomFactor * (mouseXRel - imgX);
	imgY = mouseYRel - zoomFactor * (mouseYRel - imgY);

	// Apply the transform
	updateContainerTransform();

}


async function updateContainerTransform() {
	const transformValue = `translate(${imgX}px, ${imgY}px) scale(${zoomLevel})`;
	innerContainer.style.transform = transformValue;

}

async function getTouchDistance(e) {
	const dx = e.touches[0].clientX - e.touches[1].clientX;
	const dy = e.touches[0].clientY - e.touches[1].clientY;
	return Math.sqrt(dx * dx + dy * dy);
}

// Prevent right-click context menu
innerContainer.addEventListener('contextmenu', (e) => e.preventDefault());

//move image to correct lat lon
function determineDistance(canvasObj) {
	const fullmapbbox = [-180, -90, 180, 90];
	//get in model_extent.json
	const forecastbbox = [-134.12142793280148, 21.14706163554821, -60.92779791187436, 52.62870288555903];

	// Map dimensions in pixels (you need to know these dimensions)
	const mapPixelWidth = canvasObj.width;  // Same as image
	const mapPixelHeight = canvasObj.width / 2; // /2 because of aspect ratio of platecarree

	// Calculate the width and height of the full map and forecast in degrees
	const lon_min_map = fullmapbbox[0];
	const lat_min_map = fullmapbbox[1];
	const lon_max_map = fullmapbbox[2];
	const lat_max_map = fullmapbbox[3];

	const lon_min_forecast = forecastbbox[0];
	const lat_min_forecast = forecastbbox[1];
	const lon_max_forecast = forecastbbox[2];
	const lat_max_forecast = forecastbbox[3];

	// Width and height of the full map in degrees
	const widthMap = lon_max_map - lon_min_map;
	const heightMap = lat_max_map - lat_min_map;

	// Width and height of the forecast image in degrees
	const widthForecast = lon_max_forecast - lon_min_forecast;
	const heightForecast = lat_max_forecast - lat_min_forecast;

	// Calculate pixels per degree for the full map
	const pixelsPerLon = mapPixelWidth / widthMap;
	const pixelsPerLat = mapPixelHeight / heightMap;

	// Calculate the size of the forecast image in pixels
	const forecastPixelWidth = widthForecast * pixelsPerLon;
	const forecastPixelHeight = heightForecast * pixelsPerLat;

	// Calculate the offset of the forecast image relative to the full map
	const startX = (lon_min_forecast - lon_min_map) * pixelsPerLon;
	const startY = (lat_max_map - lat_max_forecast) * pixelsPerLat; // Note: y-axis is inverted in most graphics

	// Apply the calculated size and position to the forecast image
	const forecastImage = document.getElementById('forecast');
	canvas.style.width = `${forecastPixelWidth}px`;
	canvas.style.height = `${forecastPixelHeight}px`;
	canvas.style.left = `${startX}px`;
	canvas.style.top = `${startY}px`;

}

function scaleImages() {
	// Get all the images within the div
	const images = innerContainer.querySelectorAll(('canvas'));
	let loadedImagesCount = 0;

	map.Width = desiredWidth
	map.height = desiredWidth / 2; // /2 because of aspect ratio of platecarree

	// Function to check if all images are loaded
	let checkAllImagesLoaded = () => {
		loadedImagesCount++;
		// If all images are loaded, scale them
		if (loadedImagesCount === images.length) {
			for (let i = 0; i < images.length; i++) {
				images[i].style.width = `${desiredWidth}px`;
				images[i].style.height = `${desiredHeight}px`;
			}
		}
	};

	// Attach load event to each image
	for (let i = 0; i < images.length; i++) {
		// If the image is already loaded
		if (images[i].complete) {
			checkAllImagesLoaded();
		} else {
			// If the image is not loaded yet, add an event listener
			images[i].addEventListener('load', checkAllImagesLoaded);
			// Optional: Add error handling
			images[i].addEventListener('error', checkAllImagesLoaded);
		}
	}
}

// Call the function to scale images
scaleImages();

