<?php
header("Content-Type: text/event-stream");
header("Cache-Control: no-cache");
header("Connection: keep-alive");

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
	include 'getLastRun.php';
	$run = sanitizeFilename($_GET['run'] ?? getLastRun($model));
}

$model_path = $_SERVER['DOCUMENT_ROOT'] . "/downloads/" . $model;
$run_path = $_SERVER['DOCUMENT_ROOT'] . "/downloads/" . $model . "/" . $run;

$known_runs = is_dir($model_path) ? scandir($model_path) : [];
$known_files = is_dir($run_path) ? scandir($run_path) : [];

while (true) {
    clearstatcache();

    // Detect new folders inside the model directory
    if (is_dir($model_path)) {
        $current_runs = scandir($model_path);
        $new_runs = array_diff($current_runs, $known_runs, ['.', '..']);

        if (!empty($new_runs)) {
            $known_runs = $current_runs;
            echo "data: " . json_encode(["run" => array_values($new_runs)[0]]) . "\n\n";
            ob_flush();
            flush();
        }
    }

    // Detect new files inside the run directory
    if ($run && is_dir($run_path)) {
        $current_files = scandir($run_path);
        $new_files = array_diff($current_files, $known_files, ['.', '..']);

        if (!empty($new_files)) {
            $known_files = $current_files;
            echo "data: " . json_encode(["forecast" => array_values($new_files)[0]]) . "\n\n";
            ob_flush();
            flush();
        }
    }

    sleep(2);
}
