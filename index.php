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
		
		    /* Container for dropdown menu */
		.dropdown-container 
		  border: 1px solid #ccc;
		  padding: 10px;
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
		  background-color: #f9f9f9;
		  border: 1px solid #ccc;
		  width: 100%;
		  box-sizing: border-box;
		}

		/* Links inside dropdown */
		.dropdown-content a {
		  display: block;
		  padding: 10px;
		  text-decoration: none;
		  color: black;
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
		}

		.arrow {
		  float: right;
		}

		/* Rotates the arrow when the sub-menu is open */
		.open .arrow {
		  transform: rotate(90deg);
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
            width: 70%;
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
            z-index: 2;
        }

            .slider::-webkit-slider-thumb {
                -webkit-appearance: none;
                width: 25px;
                height: 25px;
                border-radius: 50%;
                background: #333;
                cursor: pointer;
                z-index: 3;
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

        .unavailable-rectangle {
            position: absolute;
            height: 15px;
            background: #919191;
            border-radius: 0 5px 5px 0;
            z-index: 1;
        }

		
    </style>
</head>

<script>
	function resizeCanvas(){
		document.getElementById("map").width = document.getElementById("canvas").width;
		document.getElementById("map").height= document.getElementById("canvas").height;
	}
	let request = "<?php echo $_GET['request'] ?? 'model'; ?>";
	let model = "<?php echo $_GET['model'] ?? 'HRRR'; ?>";
	let variable = "<?php echo $_GET['variable'] ?? 'CAPE'; ?>";
	let level = "<?php echo $_GET['level'] ?? 'all_lev'; ?>";
	let data = <?php require 'getListOfFiles.php';?>;
	let run = data["run"]*1000;
	let runNb = new Date(parseInt(run)).getUTCHours();
	let minValue = data["vmin"];
	let maxValue = data["vmax"];

	//inverted colormaps
	if (variable!="CIN"){
		nodata = data["vmin"];
	} else {
		nodata = data["vmax"]
		
	}

</script>
<body>
	<div id="menu">
		<h1>
			WEPX Weather Toolkit
		</h1>
		
		<iframe src="dropdownmenu.html" scrolling="no" frameborder="0" seamless></iframe>
		
	</div>
	<div id="timeline_control">
		<div class="slider-container">
			<div class="track"></div>
			<div class="fill-left"></div>
			<div class="unavailable-rectangle"></div>
			<input type="range" min="0" max="48" value="0" class="slider" id="range-slider">
		</div>
		<div style="display: flex; width: 30%; justify-content: center;">
			<h3 id="forecastTime" style="color: white; font-family: system-ui;"></h3>
		</div>
	</div>
	<div id="container">
		<!-- Inner container that holds all images -->
		<div id="tooltip" class="tooltip"></div>
		<div id="inner-container">
			<!-- Add multiple images of varying sizes -->
			<canvas class="image" id="canvas" style="top: 0px; left: 0px; z-index:50"></canvas>
			<img class="image" id="map" src="full_map.webp" alt="Main Image" style="top: 0; left: 0; z-index:99">

		</div>
	</div>

	<script src="imageContainer.js"></script>
	<script src="canvasGenerator.js"></script>
	<script src="menuGenerator.js"></script>
	
</body>
</html>
