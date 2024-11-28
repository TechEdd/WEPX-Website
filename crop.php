<?php
// Input parameters: bbox (xmin, ymin, xmax, ymax)
if (!isset($_GET['xmin'], $_GET['ymin'], $_GET['xmax'], $_GET['ymax'])) {
    die('Missing bbox parameters.');
}

$xmin = floatval($_GET['xmin']);
$ymin = floatval($_GET['ymin']);
$xmax = floatval($_GET['xmax']);
$ymax = floatval($_GET['ymax']);

// Load extent configuration
$extentFile = 'model_extent.json';
if (!file_exists($extentFile)) {
    die('Extent file not found.');
}

$extentData = json_decode(file_get_contents($extentFile), true);
if (!$extentData || !isset($extentData['HRRR'])) {
    die('Invalid extent file.');
}

// Extract extent data
$mapExtent = [
    'xmin' => $extentData['HRRR'][0],
    'ymin' => $extentData['HRRR'][1],
    'xmax' => $extentData['HRRR'][2],
    'ymax' => $extentData['HRRR'][3]
];

// Load map image (WebP file)
$mapImageFile = 'DPT.lev_2_m_above_ground.01.webp'; // Update this to your actual map image path
if (!file_exists($mapImageFile)) {
    die('Map image not found.');
}

// Get image dimensions
$imageSize = getimagesize($mapImageFile);
if (!$imageSize) {
    die('Could not get map image dimensions.');
}

$imageWidth = $imageSize[0];
$imageHeight = $imageSize[1];

// Calculate pixel coordinates of the bbox
$pixelXmin = ($xmin - $mapExtent['xmin']) / ($mapExtent['xmax'] - $mapExtent['xmin']) * $imageWidth;
$pixelYmin = ($mapExtent['ymax'] - $ymax) / ($mapExtent['ymax'] - $mapExtent['ymin']) * $imageHeight;
$pixelXmax = ($xmax - $mapExtent['xmin']) / ($mapExtent['xmax'] - $mapExtent['xmin']) * $imageWidth;
$pixelYmax = ($mapExtent['ymax'] - $ymin) / ($mapExtent['ymax'] - $mapExtent['ymin']) * $imageHeight;

// Round pixel coordinates
$cropX = max(0, round($pixelXmin));
$cropY = max(0, round($pixelYmin));
$cropWidth = min($imageWidth, round($pixelXmax - $pixelXmin));
$cropHeight = min($imageHeight, round($pixelYmax - $pixelYmin));

// Ensure valid cropping dimensions
if ($cropWidth <= 0 || $cropHeight <= 0) {
    die('Invalid crop dimensions.');
}

// Create cropped image
$mapImage = imagecreatefromwebp($mapImageFile);
if (!$mapImage) {
    die('Could not load map image.');
}

$croppedImage = imagecrop($mapImage, [
    'x' => $cropX,
    'y' => $cropY,
    'width' => $cropWidth,
    'height' => $cropHeight
]);

if (!$croppedImage) {
    die('Could not crop the image.');
}

// Output the cropped image as a lossless WebP
header('Content-Type: image/webp');
imagewebp($croppedImage, null, IMG_WEBP_LOSSLESS); // Quality = 100 ensures lossless WebP output
imagedestroy($mapImage);
imagedestroy($croppedImage);
?>
