<?php
// Get URL parameters
$request = $_GET['request'] ?? null;
$model = $_GET['model'] ?? null;
$run = $_GET['run'] ?? null;
$variable = $_GET['variable'] ?? null;
$level = $_GET['level'] ?? null;

// Validate the parameters
if (!$model || !$run || !$variable || !$level || !$request) {
    die("Missing required URL parameters.\n 
	");
}

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
    // Ensure the file matches the pattern
    return preg_match("/\.$variable\.$level\.webp$/", $file);
});

// Output the file paths
if (empty($filteredFiles)) {
    echo "No matching files found.";
} else {
    foreach ($filteredFiles as $file) {
        echo $directory . $file . "\n";
    }
}

?>