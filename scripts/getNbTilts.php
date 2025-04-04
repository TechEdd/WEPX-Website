<?php
require_once 'sanitizeFilename.php';

// Get input parameters from the request (e.g., via GET or POST)
$radar_id = sanitizeFilename($_GET['radar_id'] ?? null);
$variable = sanitizeFilename($_GET['variable'] ?? null);
$start = (int)(sanitizeFilename($_GET['start'] ?? 10)); // Default to 10 (10th-to-last file)
$end = (int)(sanitizeFilename($_GET['end'] ?? 0));      // Default to 0 (most recent file)

// Validate inputs
if (!$radar_id || !$variable || $start < $end || $start < 0) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid or missing parameters. Ensure start >= end and both are non-negative.']);
    exit;
}

// Directory where radar files are stored
$directory = "../downloads/radars/{$radar_id}/"; 

// Check if directory exists
if (!is_dir($directory)) {
    http_response_code(404);
    echo json_encode(['error' => 'Radar directory not found']);
    exit;
}

// Pattern to match files: radar_id/variable.tiltX.epoch.webp
$file_pattern = "{$directory}{$variable}.tilt*.webp";

// Get all matching files
$files = glob($file_pattern);
if ($files === false || empty($files)) {
    echo json_encode(['radar_id' => $radar_id, 'variable' => $variable, 'max_tilts' => 0]);
    exit;
}

// Extract epoch times and tilt numbers, and sort by epoch
$file_data = [];
foreach ($files as $file) {
    if (preg_match("/{$variable}\.tilt(\d+)\.(\d+)\.webp/", basename($file), $matches)) {
        $tilt = (int)$matches[1];  // Tilt number (e.g., 1)
        $epoch = (int)$matches[2]; // Epoch time (e.g., 1743006963)
        $file_data[] = ['tilt' => $tilt, 'epoch' => $epoch];
    }
}

// Sort files by epoch time (newest first)
usort($file_data, function ($a, $b) {
    return $b['epoch'] - $a['epoch']; // Descending order
});

// Calculate the slice indices (convert from "last X to last Y" to array indices)
$total_files = count($file_data);
$start_index = max(0, $total_files - $start - 1); // e.g., if start=10, 10th-to-last is total - 10
$end_index = max(0, $total_files - $end - 1);     // e.g., if end=0, last file is total - 1
$length = $end_index - $start_index + 1;          // Number of files in the range

// Ensure indices are valid
if ($start_index >= $total_files || $end_index < 0 || $length <= 0) {
    echo json_encode(['radar_id' => $radar_id, 'variable' => $variable, 'max_tilts' => 0]);
    exit;
}

// Take the specified range of files
$recent_files = array_slice($file_data, $start_index, $length);

// Find the maximum tilt from the selected files
$max_tilt = 0;
foreach ($recent_files as $file) {
    $max_tilt = max($max_tilt, $file['tilt']);
}

// Output JSON response
echo $max_tilt
?>