<?php
// Input parameters: bbox (xmin, ymin, xmax, ymax)
if (!isset($_GET['xmin'], $_GET['ymin'], $_GET['xmax'], $_GET['ymax'])) {
    die('Missing bbox parameters.');
}

if (!isset($_GET['file'])) {
    die('No file asked.');
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
$mapImageFile = realpath($_GET['file']);
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

// Handle padding if bbox is outside image extent
$padLeft = max(0, -round($pixelXmin));
$padTop = max(0, -round($pixelYmin));
$padRight = max(0, round($pixelXmax) - $imageWidth);
$padBottom = max(0, round($pixelYmax) - $imageHeight);

// Calculate the resolution of the requested bbox
$outputWidth = round(($xmax - $xmin) / ($mapExtent['xmax'] - $mapExtent['xmin']) * $imageWidth);
$outputHeight = round(($ymax - $ymin) / ($mapExtent['ymax'] - $mapExtent['ymin']) * $imageHeight);

// Create a transparent canvas with the requested resolution
$outputImage = imagecreatetruecolor($outputWidth, $outputHeight);
imagesavealpha($outputImage, true);
$transparentColor = imagecolorallocatealpha($outputImage, 0, 0, 0, 127);
imagefill($outputImage, 0, 0, $transparentColor);

// Load and crop the map image
$mapImage = imagecreatefromwebp($mapImageFile);
if (!$mapImage) {
    die('Could not load map image.');
}

// Adjust crop coordinates within image bounds
$cropX = max(0, round($pixelXmin));
$cropY = max(0, round($pixelYmin));
$cropWidth = min($imageWidth - $cropX, round($pixelXmax - $pixelXmin));
$cropHeight = min($imageHeight - $cropY, round($pixelYmax - $pixelYmin));

// Copy the cropped image onto the transparent canvas at the correct position
if ($cropWidth > 0 && $cropHeight > 0) {
    $croppedImage = imagecrop($mapImage, [
        'x' => $cropX,
        'y' => $cropY,
        'width' => $cropWidth,
        'height' => $cropHeight
    ]);

    if ($croppedImage) {
        imagecopy($outputImage, $croppedImage, $padLeft, $padTop, 0, 0, $cropWidth, $cropHeight);
        imagedestroy($croppedImage);
    }
}

// Output the final image as a lossless WebP
header('Content-Type: image/webp');
imagewebp($outputImage, null, IMG_WEBP_LOSSLESS); // Quality = 100 ensures lossless WebP output
imagedestroy($mapImage);
imagedestroy($outputImage);
?>
