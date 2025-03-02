<?php
	require 'sanitizeFilename.php';

	function formatEpoch($epoch) {
		return date('Y-m-d H:i', $epoch);
	}
	
	if (!(isset($run) || isset($model))){
		$model = sanitizeFilename($_GET['model'] ?? 'HRRR');
		include 'getLastRun.php';
		$run = sanitizeFilename($_GET['run'] ?? getLastRun($model));
	}

	// Define the path
	$path = $_SERVER['DOCUMENT_ROOT'] . "/downloads/" . $model;

	// Check if the path is a directory
	if (is_dir($path)) {
		// Scan the directory for folders
		$folders = array_reverse(array_filter(glob($path . '/*'), 'is_dir'));

		// Generate the links for each folder
		foreach ($folders as $folder) {
			$run = basename($folder); // Extract the folder name

			echo '<a href="javascript:(function(){updateUrlVariable(\'run\', \'' . htmlspecialchars($run) . '\');reloadImagesPrepare()})()">' . formatEpoch($run) . '</a>';
		}
	} else {
		echo '<p>Invalid path or no folders found.</p>';
	}

?>
