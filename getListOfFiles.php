<?php
//ex: getListOfFiles.php?request=model&model=HRRR&run=00&variable=CAPE&level=all_lev
// Get URL parameters
$request = $_GET['request'] ?? 'model';
$model = $_GET['model'] ?? 'HRRR';
$run = $_GET['run'] ?? '00';
$variable = $_GET['variable'] ?? 'CAPE';
$level = $_GET['level'] ?? 'all_lev';

// Validate the parameters
if (!$model || !$run || !$variable || !$level || !$request) {
    die("Missing required URL parameters.\n 
	");
}

// Define the directory to search
$directory = "../downloads/$model/$run/";

if ($request == "model"){
// Define the directory to search
$directory = "../WEPX Weather Toolkit Backend/downloads/$model/$run/";
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
    return preg_match("/\.$variable\.$level\.webp$/", $file);
});

// Prepare output data
$output = [];

// Prepare output data
$vmin = null;
$vmax = null;
$run = null;
$files = [];

foreach ($filteredFiles as $file) {
    $filePath = $directory . $file;
    $jsonFilePath = preg_replace("/\.webp$/", ".json", $filePath);

    if (file_exists($jsonFilePath)) {
        $metadata = json_decode(file_get_contents($jsonFilePath), true);

        // Set vmin, vmax, and run only once
        if ($vmin === null && $vmax === null && $run === null && isset($metadata["vmin"], $metadata["vmax"], $metadata["run"])) {
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
