<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Multiple Image Pan/Zoom with Touch Support</title>
    <style>
        body {
            margin: 0;
            overflow: hidden;
            user-select: none;
        }
		
		img {
			will-change: transform;
		}
		
        #container {
            width: 100vw;
            height: 100vh;

            justify-content: center;
            align-items: center;
            background-color: #ddd;
            position: relative;
            overflow: hidden;
			z-index: 1;
        }
        #inner-container {
            transform-origin: center;
            position: absolute;
        }
        .image {
            position: absolute;
			left: 50%;
			transform: translate(-50%, -50%);
			top: 50%;
			border: 2px solid black;
        }
        #inner-container.dragging {
            cursor: grabbing;
        }
		#menu {
			position: fixed;
			width: 18vw;
			height: 100vh;
			background-color: #1f1e1e;
			z-index:60;
			overflow-x: hidden;
		}

		#menu::-webkit-scrollbar-track-piece:start {
		  background: transparent;
		}

		#menu::-webkit-scrollbar-track-piece:end {
		  background: transparent;
		}

		::-webkit-scrollbar {
		  width: 8px;
		  background: transparent; 
		}

		::-webkit-scrollbar-track {
		}
		/* Handle */
		::-webkit-scrollbar-thumb {
		  background: #999; 
		  border-radius: 7px;
}
		}

		/* Handle on hover */
		::-webkit-scrollbar-thumb:hover {
		  background: #555; 
		}

        #timeline_control {
            position: fixed;
            width: 82vw;
            height: 10vh;
            background-color: #1f1e1e;
            z-index: 99;
            right: 0;
            bottom: 0;
            display: flex;
        }
		h1 {
			font-family: system-ui;
			color: white;
			font-size: medium;
			text-align: center;
		}	
		#upper_info {
			position: fixed;
			width: 82vw;
			background-color: #1f1e1e;
			z-index: 99;
			right: 0;
			top: 0;
			display: flex;
		}
		
		canvas {
		  image-rendering: pixelated;
		  image-rendering: crisp-edges;
		  image-rendering: -moz-crisp-edges;
		}
		
		iframe {
			width: inherit;
			height: 80vh;
		}
		
		.tooltip {
			position: absolute;
			display: none;
			background-color: black;
			color: white;
			padding: 5px;
			border-radius: 5px;
			font-size: 12px;
			opacity: 0.6;
			z-index: 200;
			user-select: none;
			-webkit-user-select: none; /* Safari */        
			-moz-user-select: none; /* Firefox */
			-ms-user-select: none; /* IE10+/Edge */
			font-family: system-ui;
		}

		/* slider */

        .slider-container {
            position: relative;
            height: 100%;
            display: flex;
            align-items: center;
        }

        .slider {
            -webkit-appearance: none;
            width: 102%;
            height: 15px;
            left: -5px;
            border-radius: 5px;
            background: transparent;
            position: absolute;
            z-index: 3;
        }

        .slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 25px;
            height: 25px;
            border-radius: 50%;
            background: #333;
            cursor: pointer;
            z-index: 4;
            position: relative;
        }

        .slider::-moz-range-thumb {
            width: 25px;
            height: 25px;
            border-radius: 50%;
            background: #333;
            cursor: pointer;
        }

        .track {
            position: absolute;
            width: 100%;
            height: 15px;
            border-radius: 5px;
            background: lightgray;
            z-index: 0;
        }

        .fill-left {
            position: absolute;
            height: 15px;
            background: #83c8f2;
            border-radius: 5px 0 0 5px;
            z-index: 2;
        }

		.available {
			position: absolute;
			height: 15px;
			background: #83c75b;
			border-radius: 0 5px 5px 0;
			z-index:3;
			transition: width 0.2s linear, opacity 1s linear;
		}

        .unavailable-rectangle {
            position: absolute;
            height: 15px;
            background: #919191;
            border-radius: 0 5px 5px 0;
            z-index: 1;
        }

		/* menu */
		
		   /* Container for dropdown menu */
		.dropdown-container {
		  position: relative;
		}

		/* Button to toggle main dropdown */
		.dropdown-btn {
		  background-color: #4CAF50;
		  color: white;
		  padding: 12px;
		  font-size: 16px;
		  border: none;
		  width: 100%;
		  cursor: pointer;
		  text-align: left;
		}

		/* Dropdown content (initially hidden) */
		.dropdown-content {
		  display: none;
		  background-color: transparent;
		  width: 100%;
		  box-sizing: border-box;
		  color: white;
		  padding: 2px;
		  user-select: none;
		  -webkit-user-select: none; /* Safari */        
		  -moz-user-select: none; /* Firefox */
		  -ms-user-select: none; /* IE10+/Edge */
		  font-family: system-ui;
		}

		/* Links inside dropdown */
		.dropdown-content a {
		  display: block;
		  padding: 5px;
		  text-decoration: none;
		  color: white;
		  cursor: pointer;
		  width: 100%;
		  box-sizing: border-box;
		}

		/* Change link color on hover */
		.dropdown-content a:hover {
		  background-color: #f1f1f1;
		}

		/* Sub-dropdown styling */
		.nested-dropdown-content {
		  display: none;
		  padding-left: 20px;
		}
		
		/* Expandable sections with an arrow indicator */
		.expandable {
		  cursor: pointer;
		  padding: 2px;
		}

		.arrow {
		  float: right;
		}

		/* Rotates the arrow when the sub-menu is open */
		.open .arrow {
		  transform: rotate(90deg);
		}
	

		
    </style>
</head>

<script>
	function resizeCanvas(){
		map.width = document.getElementById("canvas").width;
		map.height= document.getElementById("canvas").height;
	}
	<?php 
		function sanitizeFilename($input) {
			// Remove any directory traversal attempts or file paths
			$input = basename($input);
			// Optionally, ensure the input contains only safe characters
			return preg_replace('/[^a-zA-Z0-9_-]/', '', $input);
		} 
	?>
	let zoomMode = "zoomed";
	const url = new URL(window.location.href);
	let xmin = url.searchParams.get("xmin");
	let xmax = url.searchParams.get("xmax");
	let ymin = url.searchParams.get("ymin");
	let ymax = url.searchParams.get("ymax");
	let request = "<?php echo sanitizeFilename($_GET['request'] ?? 'model'); ?>";
	let model = "<?php $model = sanitizeFilename($_GET['model'] ?? 'HRRR'); echo $model; ?>";
	let variable = "<?php $variable =sanitizeFilename($_GET['variable'] ?? 'CAPE'); echo $variable; ?>";
	let level = "<?php echo sanitizeFilename($_GET['level'] ?? 'lev_surface'); ?>";
	let data = <?php require 'scripts/getListOfFiles.php';?>;
	var run1 = data["run"]*1000;
	var runNb = new Date(parseInt(run1)).getUTCHours();
	var minValue = data["vmin"];
	var maxValue = data["vmax"];
	//let isInvertedColormap = (variable === "CIN" || variable === "SBT124" || minValue>maxValue);
	let isInvertedColormap = false;
	let colorTable = <?php
		if ($variable) {
			// Sanitize the variable to prevent directory traversal attacks
			$safeVariable = basename($variable);

			// Construct the file path
			$filePath = "colormaps/" . $safeVariable . ".txt";

			// Check if the file exists
			if (file_exists($filePath)) {
				// Read and echo the file contents
				include($filePath);
			} else {
				// Handle the case where the file does not exist
				echo "Error: File not found.";
			}
		} else {
			// Handle the case where 'variable' is not provided
			echo "Error: No variable provided.";
		}
	
	?>
	
	//inverted colormaps
	if (variable!="CIN"){
		nodata = data["vmin"];
	} else {
		nodata = data["vmax"]
		
	}
	
	window.onload = function() {
            document.getElementById("modelIndicator").innerHTML = "Model: " + model;
            document.getElementById("layerIndicator").innerHTML = document.getElementById(variable).innerHTML;
			document.getElementById("runSelect").innerHTML = "Run: " +  new Date(parseInt(run1)).toISOString().replace('T', ' ').slice(0, 16) + 'z';
    };

</script>
<body>
	<div id="menu">
		<h1 onclick="window.location.href='/'" style="cursor: pointer;">
			WEPX Weather Toolkit
		</h1>
		
		<?php include("scripts/dropdownmenu.html")?>
		<?php include("scripts/{$model}menu.html")?>
		<div class="dropdown-container">
			<button id="runSelect" class="dropdown-btn" onclick="toggleDropdown('dropdownRun')">Run</button>
			<div id="dropdownRun" class="dropdown-content">
				<?php
					// Define the path
					$path = __DIR__ . "/downloads/" . $model;

					// Check if the path is a directory
					if (is_dir($path)) {
						// Scan the directory for folders
						$folders = array_filter(glob($path . '/*'), 'is_dir');

						// Generate the links for each folder
						foreach ($folders as $folder) {
							$run = basename($folder); // Extract the folder name
							echo '<a href="javascript:(function(){updateUrlVariable(\'run\', \'' . htmlspecialchars($run) . '\');reloadImagesPrepare()})()">' . htmlspecialchars($run) . '</a>';
						}
					} else {
						echo '<p>Invalid path or no folders found.</p>';
					}
					?>

			</div>
		</div>
	</div>

	<div id="upper_info">
		<h1 id="modelIndicator" style="margin-left: 1vw;">Model: </h1>
		<h1 id="layerIndicator" style="text-align: end; flex: 1;margin-right: 1vw;">Layer: </h1>
	</div>
	<div id="timeline_control">
		<div id="animateButtonDiv" style="width: 5%; display: flex; justify-content: center;">
			<button id="animateButton" style="border: none; background: transparent; cursor: pointer; padding: 10px; margin: 5px;">
				<svg class="play-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="5 3, 19 12, 5 21"></polygon>
				</svg>
				<svg class="pause-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none;">
					<rect x="6" y="4" width="4" height="16"></rect>
					<rect x="14" y="4" width="4" height="16"></rect>
				</svg>
			</button>
		</div>
		<div class="slider-container" style="width: 70%;">
			<div class="track"></div>
			<div class="fill-left"></div>
			<div class="available"></div>
			<div class="unavailable-rectangle"></div>
			<input type="range" min="0" max="48" value="0" class="slider" id="range-slider">
		</div>
		<div style="display: flex; width: 20%; justify-content: center;">
			<h3 id="forecastTime" style="color: white; font-family: system-ui;"></h3>
		</div>
	</div>
	<div id="container">
		<!-- Inner container that holds all images -->
		<div id="colormapDiv" style="position: absolute; width=50px; right: 1vw; bottom: 12vh; z-index:150; background: #b0b0b0;">
			<p id="colormapVariable" style="TEXT-ALIGN: center; font-family: system-ui; margin: 5px;"></p>
			<canvas id="colormapCanvas" width="10" height="100" style="border: 1px solid black; right: 5px; display: flex; justify-self: flex-end; margin: 10px;"></canvas>
		</div>
		<div id="tooltip" class="tooltip"></div>
		<div id="inner-container" style="width: 82vw; right: 0; height: 100%; height: calc(100% - 2.6em - 10vh); top: 2.6em;">
			<!-- Add multiple images of varying sizes -->
			<canvas class="image" id="canvas" style="z-index:50"></canvas>
			<canvas class="image" id="map" alt="Main Image" style="z-index:99"></canvas>

		</div>
	</div>
	
</body>
</html>

<script>
const map = document.getElementById("map");
const innerContainer = document.getElementById("inner-container");
const container = document.getElementById("container");
const slider = document.getElementById('range-slider');
const canvas = document.getElementById('canvas');
const forecastTimeText = document.getElementById("forecastTime");
const fullmapbbox = [-180, -90, 180, 90];
//futurely get in model_extent.json
let forecastbbox = [-134.12142793280148, 21.14706163554821, -60.92779791187436, 52.62870288555903];
</script>

<script src="js/canvasGenerator.js"></script>
<script src="js/menuGenerator.js"></script>

<script>
	//function scaling the canvas
	function determineDistance(canvasObj){
		// Get the dimensions of the container and 80% for border
		const containerWidth = container.clientWidth * 0.8;
		const containerHeight = container.clientHeight * 0.8;

		// Get the original dimensions of the canvas (assumed to be set beforehand)
		const canvasWidth = canvas.width;
		const canvasHeight = canvas.height;

		// Calculate the scale factors for width and height 
		const scaleWidth = (containerWidth / canvasWidth);
		const scaleHeight = (containerHeight / canvasHeight);

		// Choose the smaller scale factor to preserve aspect ratio
		const scale = Math.min(scaleWidth, scaleHeight);

		// Set only the dimension corresponding to the longest side to preserve aspect ratio
		if (scaleWidth < scaleHeight) {
		  map.style.width = canvas.style.width = `${containerWidth}px`;
		  map.style.height = canvas.style.height = 'auto';
		} else {
		  map.style.height = canvas.style.height = `${containerHeight}px`;
		  map.style.width = canvas.style.width = 'auto';
		}


	}
	window.addEventListener('resize', determineDistance);

	//crop map
	function cropMap() {
		const imageObj = new Image();
		const context = map.getContext('2d');

		fetch('full_map.svg')
			.then(response => response.text())
			.then(svgText => {
				// Parse the SVG text into XML
				const parser = new DOMParser();
				const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
            
				// Reduce stroke width
				const paths = svgDoc.querySelectorAll('path, line, rect, circle, polyline, polygon');
				paths.forEach(path => {
					const currentStrokeWidth = parseFloat(path.getAttribute('stroke-width')) || 1;
					const newStrokeWidth = currentStrokeWidth / 30; //factor
					path.setAttribute('stroke-width', newStrokeWidth);
				});

				// Serialize the modified SVG back to a string
				const modifiedSVG = new XMLSerializer().serializeToString(svgDoc);

				// Set the SVG as the source for the image object
				imageObj.src = 'data:image/svg+xml;base64,' + btoa(modifiedSVG);

				// When the image is loaded, render it to the canvas
				imageObj.onload = function() {
					const imageWidth = imageObj.width;  // Image width
					const imageHeight = imageObj.height;  // Image height

					console.log(imageWidth, imageHeight);

					// Calculate pixel coordinates for cropping
					const pixelXmin = (xmin - fullmapbbox[0]) / (fullmapbbox[2] - fullmapbbox[0]) * imageWidth;
					const pixelYmin = (fullmapbbox[3] - ymax) / (fullmapbbox[3] - fullmapbbox[1]) * imageHeight;
					const pixelXmax = (xmax - fullmapbbox[0]) / (fullmapbbox[2] - fullmapbbox[0]) * imageWidth;
					const pixelYmax = (fullmapbbox[3] - ymin) / (fullmapbbox[3] - fullmapbbox[1]) * imageHeight;

					console.log(pixelXmin, pixelYmin, pixelXmax, pixelYmax);

					// Round pixel coordinates and ensure valid crop dimensions
					const cropX = Math.max(0, Math.round(pixelXmin));
					const cropY = Math.max(0, Math.round(pixelYmin));
					const cropWidth = Math.min(imageWidth, pixelXmax - pixelXmin);
					const cropHeight = Math.min(imageHeight, pixelYmax - pixelYmin);

					// Ensure valid cropping dimensions
					if (cropWidth <= 0 || cropHeight <= 0) {
						console.error('Invalid crop dimensions.');
						return;
					}

					// Set the map size to match approx the cropped image resolution
					map.width = cropWidth*20;
					map.height = cropHeight*20;

					canvas.style.aspectRatio = map.style.aspectRatio = map.width/map.height;

					// Draw the cropped portion of the image onto the canvas
					context.drawImage(imageObj, pixelXmin, pixelYmin, cropWidth, cropHeight, 0, 0, map.width, map.height);
				};
			})
        .catch(error => console.error('Error loading SVG:', error));
	}

	// Call the function
	cropMap();


</script>

<script>
//check value

let cursorX = 0, cursorY = 0;
container.addEventListener('mousemove', (e) => {
	
	cursorX = e.clientX;
	cursorY = e.clientY;

	tooltip.textContent = getPixelValue();
	tooltip.style.right = `${window.innerWidth - e.pageX - tooltip.offsetWidth / 2}px`; // Center horizontally using right (because right:0 in outer container)
	tooltip.style.top = `${e.pageY - 40}px`; // Center vertically
	tooltip.style.display = 'block';             // Make the tooltip visible

});

container.addEventListener('mouseleave', () => {
	tooltip.style.display = 'none'; // Hide the tooltip
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
	if (value == null || isNaN(value) || value == undefined) {
		return null;	
	} else {
		return value?.toFixed(2);
	};

}
</script>