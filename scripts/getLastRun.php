<?php
	// Define the path
	if(!function_exists("sanitizeFilename")) {
		function sanitizeFilename($input) {
			// Remove any directory traversal attempts or file paths
			$input = basename($input);
			// Optionally, ensure the input contains only safe characters
			return preg_replace('/[^a-zA-Z0-9_-]/', '', $input);
		}
	};

	function getLastRun($model){
		$path = $_SERVER['DOCUMENT_ROOT'] . "/downloads/" . $model;
		// Check if the path is a directory
		if (is_dir($path)) {
			// Scan the directory for folders
			$folders = array_reverse(array_filter(glob($path . '/*'), 'is_dir'));
			return htmlspecialchars(basename($folders[0]));
		} else {
			echo '<p>Invalid path or no folders found.</p>';
		}
	} 

	// If this file is accessed directly (not included), output the result
	if (basename(__FILE__) == basename($_SERVER["SCRIPT_FILENAME"])) {
		if (!isset($model)){
		$model = sanitizeFilename($_GET['model'] ?? 'HRRR');
		} else {
			echo '<p>Invalid path or no folders found.</p>';
		};	
		echo getLastRun($model);
	}
	
?>