let mode = "model";
let model = "HRDPS";
let varName = "2mT";
let width = "12000";
let height = "8000";

varNames = {
	"2mT": "TT",
	"2mRH": "RH"
}

modelNames = {
	"HRDPS": "HRDPS.CONTINENTAL",
	"GDPS": "GDPS.ETA"
}

const urlParams = new URLSearchParams(window.location.search);

function changeModel(modelName){
	urlParams.set('model', modelName);
	urlParams.set('mode', "model");
};

function changeVariable(variable){
	urlParams.searchParams.set('variable', variable)
	varName = varNames[variable];
}

window.onload = function linkManager(){
	if(urlParams.has("mode")){
		mode = urlParams.get("mode");
	}
	if(urlParams.has("model")){
		model = urlParams.get("model")
	}
	if(urlParams.has("variable")){
		model = urlParams.get("variable")
	}
	
	getForecastImage();
	
}

function getForecastImage(){
	forecast.src = `https://geo.weather.gc.ca/geomet?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX=-90,-180,90,180&CRS=EPSG:4326&WIDTH=${width}&HEIGHT=${height}&LAYERS=${modelNames[model]}_${varNames[varName]}&TIME=2024-10-10T12%3A00%3A00Z&FORMAT=image/png`
	//https://geo.weather.gc.ca/geomet?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&BBOX=-90,-180,90,180&CRS=EPSG:4326&WIDTH=12000&HEIGHT=6000&LAYERS=HRDPS.CONTINENTAL_TT&TIME=2024-10-10T12%3A00%3A00Z&FORMAT=image/png
}