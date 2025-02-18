<?php
	function formatEpoch($epoch) {
		return date('Y-m-d H:i', $epoch);
	}


	if(!function_exists("sanitizeFilename")) {
		function sanitizeFilename($input) {
			// Remove any directory traversal attempts or file paths
			$input = basename($input);
			// Optionally, ensure the input contains only safe characters
			return preg_replace('/[^a-zA-Z0-9_-]/', '', $input);
		}
	};
	
	if (!(isset($run) || isset($model))){
		$model = sanitizeFilename($_GET['model'] ?? 'HRRR');
		$run = sanitizeFilename($_GET['run'] ?? '00');
	}

	// Define the path
	$path = __DIR__ . "/downloads/" . $model;

	// Check if the path is a directory
	if (is_dir($path)) {
		// Scan the directory for folders
		$folders = array_filter(glob($path . '/*'), 'is_dir');

		// Generate the links for each folder
		foreach ($folders as $folder) {
			$run = basename($folder); // Extract the folder name

			echo '<a href="javascript:(function(){updateUrlVariable(\'run\', \'' . htmlspecialchars($run) . '\');reloadImagesPrepare()})()">' . formatEpoch($run) . '</a>';
		}
	} else {
		echo '<p>Invalid path or no folders found.</p>';
	}

?>
