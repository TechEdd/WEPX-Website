<?php
require 'sanitizeFilename.php';
include 'getDefaultVariable.php';

// Get URL parameters
$request = sanitizeFilename($_GET['request'] ?? 'model');
$model = sanitizeFilename($_GET['model'] ?? 'HRRR');
include 'getLastRun.php';
$run = sanitizeFilename($_GET['run'] ?? getLastRun($model));
$variable = sanitizeFilename($_GET['variable'] ?? 'CAPE');
$level = sanitizeFilename($_GET['level'] ?? getDefaultVariable($model, $run, $variable));

// Define the directory to search
$directory = $_SERVER['DOCUMENT_ROOT'] . "/downloads/$model/$run/";

if ($request !== "model") {
    die("wrong request");
}

// Check if the directory exists
if (!is_dir($directory)) {
    die("Directory not found: $directory");
}

// Function to get filtered files
function getFilteredFiles($directory, $variable, $level) {
    $files = scandir($directory);
    return array_filter($files, function($file) use ($variable, $level) {
        return preg_match("/\." . preg_quote($variable, '/') . "\." . preg_quote($level, '/') . "\.webp$/", $file);
    });
}

// First attempt
$filteredFiles = getFilteredFiles($directory, $variable, $level);

// Retry with fallback level if no files found
if (empty($filteredFiles)) {
    $fallbackLevel = getDefaultVariable($model, $run, $variable);
    if ($fallbackLevel !== $level) { // Prevent infinite loops
        $level = $fallbackLevel;
        $filteredFiles = getFilteredFiles($directory, $variable, $level);
    }
}

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
