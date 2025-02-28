<?php
header("Content-Type: text/event-stream");
header("Cache-Control: no-cache");
header("Connection: keep-alive");

if(!function_exists("sanitizeFilename")) {
    function sanitizeFilename($input) {
        $input = basename($input);
        return preg_replace('/[^a-zA-Z0-9_-]/', '', $input);
    }
};

$model = sanitizeFilename($_GET['model'] ?? 'HRRR');
include 'getLastRun.php';
$run = sanitizeFilename($_GET['run'] ?? getLastRun($model));
$variable = sanitizeFilename($_GET['variable'] ?? 'CAPE');
$level = sanitizeFilename($_GET['level'] ?? 'lev_surface');

$model_path = $_SERVER['DOCUMENT_ROOT'] . "/downloads/" . $model;
$run_path = "$model_path/$run";

$known_runs = is_dir($model_path) ? scandir($model_path) : [];
$known_files = is_dir($run_path) ? scandir($run_path) : [];

while (true) {
    clearstatcache();

    // Detect new runs
    if (is_dir($model_path)) {
        $current_runs = scandir($model_path);
        $new_runs = array_diff($current_runs, $known_runs);
        if (!empty($new_runs)) {
            $new_run = array_values($new_runs)[0]; // Take the first new run found
            echo "data: " . json_encode(["run" => $new_run]) . "\n\n";
            ob_flush();
            flush();
            $known_runs = $current_runs;
        }
    }

    // Detect new files inside the run directory with filtering
    if (is_dir($run_path)) {
        $current_files = scandir($run_path);
        $new_files = array_diff($current_files, $known_files);
        foreach ($new_files as $file) {
            if (strpos($file, $variable) !== false && strpos($file, $level) !== false && substr($file, -5) === '.webp') {
                echo "data: " . json_encode(["forecast" => $file]) . "\n\n";
                ob_flush();
                flush();
            }
        }
        $known_files = $current_files;
    }

    sleep(5); // Adjust as needed
}
