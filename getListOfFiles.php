<?php

if(!function_exists("sanitizeFilename")) {
    function sanitizeFilename($input) {
	    // Remove any directory traversal attempts or file paths
	    $input = basename($input);
	    // Optionally, ensure the input contains only safe characters
	    return preg_replace('/[^a-zA-Z0-9_-]/', '', $input);
    }
};

//ex: getListOfFiles.php?request=model&model=HRRR&run=00&variable=CAPE&level=all_lev
// Get URL parameters
$request = sanitizeFilename($_GET['request'] ?? 'model');
$model = sanitizeFilename($_GET['model'] ?? 'HRRR');
$run = sanitizeFilename($_GET['run'] ?? file_get_contents('getLastRun.php?model=' . urlencode($model)));
$variable = sanitizeFilename($_GET['variable'] ?? 'CAPE');
$level = sanitizeFilename($_GET['level'] ?? 'lev_surface');

// Define the directory to search
$directory = "./downloads/$model/$run/";

if ($request == "model"){
// Define the directory to search
$directory = "./downloads/$model/$run/";
} else {
	die("wrong request");
}

// Check if the directory exists
if (!is_dir($directory)) {
    die("Directory not found: $directory");
}

// Scan the directory for matching files
$files = scandir($directory);

// Filter files based on the criteria
$filteredFiles = array_filter($files, function($file) use ($variable, $level) {
    return preg_match("/\." . preg_quote($variable, '/') . "\." . preg_quote($level, '/') . "\.webp$/", $file);
});

// Prepare output data
$output = [];

// Prepare output data
$vmin = null;
$vmax = null;
$run = null;
$nodata = null;
$files = [];

foreach ($filteredFiles as $file) {
    $filePath = $directory . $file;
    $jsonFilePath = preg_replace("/\.webp$/", ".json", $filePath);

    if (file_exists($jsonFilePath)) {
        $metadata = json_decode(file_get_contents($jsonFilePath), true);

        // Set vmin, vmax, and run only if they are not already set
        if ($vmin === null && isset($metadata["vmin"], $metadata["vmax"], $metadata["run"])) {
            $vmin = $metadata["vmin"];
            $vmax = $metadata["vmax"];
            $run = $metadata["run"];
        }

        $files[] = [
            "file" => $file,
            "forecastTime" => $metadata["forecastTime"] ?? null
        ];
    } else {
        $files[] = [
            "file" => $file,
            "run" => null,
            "forecastTime" => null
        ];
    }
}


// Output the final JSON structure
echo json_encode([
    "vmin" => $vmin,
    "vmax" => $vmax,
    "run" => $run,
    "files" => $files
], JSON_PRETTY_PRINT);

?>
