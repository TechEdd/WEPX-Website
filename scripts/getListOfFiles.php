<?php
require_once 'sanitizeFilename.php';
include_once 'getDefaultVariable.php';

// Get URL parameters
$request = sanitizeFilename($_GET['request'] ?? 'model');
if ($request != "model" && $request != "radar") {
    die("wrong request");
}
include_once 'getLastRun.php';
if ($request == "model"){
    $model = sanitizeFilename($_GET['model'] ?? 'HRRR');
    $run = sanitizeFilename($_GET['run'] ?? getLastRun($model));
    $variable = sanitizeFilename($_GET['variable'] ?? 'CAPE');
    $level = sanitizeFilename($_GET['level'] ?? getDefaultVariable($model, $run, $variable));
    $directory = __DIR__ . "/../downloads/$model/$run/";
} else if ($request == "radar"){
    $model = sanitizeFilename($_GET['model'] ?? 'CASBV');
    $level = sanitizeFilename($_GET['level'] ?? "tilt1");
    $variable = sanitizeFilename($_GET['variable'] ?? 'reflectivity_horizontal');
    $directory = __DIR__ . "/../downloads/radars/$model/";
}

// Check if the directory exists
if (!is_dir($directory)) {
    die("Directory not found: $directory");
}

// Function to get filtered files
function getFilteredFiles($directory, $variable, $level, $request) {
    if ($request == "radar"){
        $files = scandir($directory);
        return array_filter($files, function($file) use ($variable, $level) {
            return preg_match("/" . preg_quote($variable, '/') . "\." . preg_quote($level, '/') . "\..*\.webp$/", $file);
        });
	} else if ($request == "model"){
        $files = scandir($directory);
        return array_filter($files, function($file) use ($variable, $level) {
            return preg_match("/\." . preg_quote($variable, '/') . "\." . preg_quote($level, '/') . "\.webp$/", $file);
        });
    };
}

// First attempt
$filteredFiles = getFilteredFiles($directory, $variable, $level, $request);

// Retry with fallback level if no files found
if (empty($filteredFiles)) {
    if ($request == "radar"){
        $fallbackLevel = "tilt1";
    } else if ($request == "model"){
        $fallbackLevel = getDefaultVariable($model, $run, $variable);
    };
    if ($fallbackLevel !== $level) { // Prevent infinite loops
        $level = $fallbackLevel;
        $filteredFiles = getFilteredFiles($directory, $variable, $level,$request);
    }
}

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

        // Ensure vmin and vmax are taken from the first valid metadata
        if (isset($metadata["vmin"], $metadata["vmax"])) {
            $vmin = $metadata["vmin"];
            $vmax = $metadata["vmax"];
        }

        // Ensure run is set for model
        if ($request == "model" && isset($metadata["run"])) {
            $run = $metadata["run"];
        }

        $fileData = ["file" => $file];

        if ($request == "radar") {
            // Include radar-specific fields
            foreach (["scanStart", "sweepStart", "sweepStop", "scanType"] as $key) {
                if (isset($metadata[$key])) {
                    $fileData[$key] = $metadata[$key];
                }
            }
        } else {
            // Default model fields
            $fileData["forecastTime"] = $metadata["forecastTime"] ?? null;
        }

        $files[] = $fileData;
    } else {
        $files[] = ["file" => $file];
    }
}

// Output the final JSON structure
$response = ["vmin" => $vmin, "vmax" => $vmax, "files" => $files];

if ($request == "model") {
    $response["run"] = $run;
}

echo json_encode($response, JSON_PRETTY_PRINT);



?>
