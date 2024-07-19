import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useRef,
} from "react";
import {
  CatalogContextType,
  FeatureCollection,
  Feature,
} from "../types/allTypesAndInterfaces";
import { HttpReq } from "../services/apiService";
import urls from "../urls.json";
import userIdData from "../currentUserId.json"; 

const CatalogContext = createContext<CatalogContextType | undefined>(undefined);

export function CatalogProvider(props: { children: ReactNode }) {
  const { children } = props;

  const [formStage, setFormStage] = useState("catalogue");
  const [saveMethod, setSaveMethod] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isError, setIsError] = useState(false);
  const [selectedCatalog, setSelectedCatalog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [legendList, setLegendList] = useState("tes");
  const [subscriptionPrice, setSubscriptionPrice] = useState("tet");
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [selectedContainerType, setSelectedContainerType] = useState<
    "Catalogue" | "Layer" | "Home"
  >("Home");

  const [geoPoints, setGeoPoints] = useState<FeatureCollection | string>("");
  const [tempGeoPointsList, setTempGeoPointsList] = useState<
    FeatureCollection[]
  >([]);
  const [lastGeoIdRequest, setLastGeoIdRequest] = useState<
    string | undefined
  >();
  const [lastGeoMessageRequest, setLastGeoMessageRequest] = useState<
    string | undefined
  >();
  const [lastGeoError, setLastGeoError] = useState<Error | null>(null);
  const [idColors, setIdColors] = useState<Record<string, string>>({});

  const colorOptions = ["Red", "Green", "Blue", "Yellow", "Black"];
  const [selectedColor, setSelectedColor] = useState<string>("red");
  const [selectedLayers, setSelectedLayers] = useState<
    {
      name: string;
      id: string;
      color: string;
      is_zone_lyr: boolean;
      display: boolean;
    }[]
  >([]);
  const [currentlySelectedLayer, setCurrentlySelectedLayer] = useState<
    string | null
  >(null);
  const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(
    null
  );

  const colorIndexRef = useRef(Object.keys(idColors).length);

  function handleError(error: Error | null) {
    setLastGeoError(error ?? null);
  }

  function processFeatureCollection(
    item: FeatureCollection,
    id: string
  ): FeatureCollection {
    return {
      ...item,
      features: item.features.map(function (feature) {
        return {
          ...feature,
          properties: {
            ...feature.properties,
            geoPointId: id,
          },
        };
      }),
    };
  }

  function processData(
    data: FeatureCollection | FeatureCollection[],
    id: string
  ): FeatureCollection[] {
    if (Array.isArray(data)) {
      return data
        .filter(function (item) {
          return item && item.features;
        })
        .map(function (item) {
          return processFeatureCollection(item, id);
        });
    } else if (data && data.features) {
      return [processFeatureCollection(data, id)];
    }
    return [];
  }

  // Function to handle adding a new layer or catalog item
  function handleAddClick(id: string, name: string, typeOfCard: string) {
    const newColor = colorOptions[colorIndexRef.current % colorOptions.length]; // Note: In the future, this color will be provided as an argument from the clicked card.

    colorIndexRef.current += 1;

    setSelectedLayers(function (prevLayers) {
      return [
        ...prevLayers,
        {
          name,
          id,
          color: newColor,
          is_zone_lyr: typeOfCard === "layer",
          display: true,
        },
      ];
    });

    setCurrentlySelectedLayer(id);
    fetchGeoPoints(id, typeOfCard);
  }

  function updateLayerDisplay(layerIndex: number, display: boolean) {
    setSelectedLayers(function (prevLayers) {
      const updatedLayers = [...prevLayers];
      updatedLayers[layerIndex].display = display;
      return updatedLayers;
    });
  }

  // This function combines multiple FeatureCollection objects into one, assigning colors based on selectedLayers and adding properties like color and geoPointId to each feature.
  function mergeFeatures(featuresList: FeatureCollection[]): FeatureCollection {
    const mergedFeatures = featuresList.reduce(function (
      acc,
      featureCollection
    ) {
      const filteredFeatures = featureCollection.features
        .map(function (feature) {
          const id = feature.properties.geoPointId;
          const matchedLayer = selectedLayers.find(function (layer) {
            return layer.id === id;
          });
          const color = matchedLayer ? matchedLayer.color : "defaultColor"; // Assigning color based on matched layer. This ensures each feature is visually distinct on the map.
          const display = matchedLayer ? matchedLayer.display : true;

          if (!display) return null; // Skip the feature if display is false

          return {
            ...feature,
            properties: {
              ...feature.properties,
              color, // This color property is mandatory for Mapbox to style each feature. Each feature's properties must include a color key.
              geoPointId: id, // This ID is needed to group related points together, ensuring each feature is correctly associated with its layer, if the color of one change, all of them will change together
            },
          };
        })
        .filter(function (feature): feature is Feature {
          return feature !== null;
        }); // Filter out null values

      return acc.concat(filteredFeatures);
    },
    [] as Feature[]);

    return {
      type: "FeatureCollection",
      features: mergedFeatures,
    };
  }

  // Effect to update geoPoints when tempGeoPointsList or selectedLayers change
  useEffect(
    function () {
      if (tempGeoPointsList.length > 0) {
        const mergedGeoPoints = mergeFeatures(tempGeoPointsList);
        setGeoPoints(mergedGeoPoints);
      } else {
        setGeoPoints("");
      }
    },
    [tempGeoPointsList, selectedLayers]
  );

  // Function to fetch geo points for a layer or catalog item
  async function fetchGeoPoints(id: string, typeOfCard: string) {
    const apiJsonRequest =
      typeOfCard === "layer"
        ? {
            prdcer_ctlg_id: id,
            as_layers: true,
            user_id: userIdData.user_id,
          }
        : { catalogue_dataset_id: id };

    const url =
      typeOfCard === "layer" ? urls.fetch_ctlg_lyrs : urls.http_catlog_data;

    await HttpReq<FeatureCollection | FeatureCollection[]>(
      url,
      function (data) {
        const updatedDataArray = processData(data, id);

        setTempGeoPointsList(function (prevList) {
          return [...prevList, ...updatedDataArray];
        });

        if (!currentlySelectedLayer) {
          setCurrentlySelectedLayer(id);
        }
      },
      setLastGeoMessageRequest,
      setLastGeoIdRequest,
      setIsLoading,
      handleError,
      "post",
      apiJsonRequest
    );
  }

  // Function to handle saving the current state
  function handleSave() {
    const saveData = {
      catalogId: selectedCatalog?.id,
      description,
      name,
      saveMethod,
    };

    setIsLoading(true);

    setTimeout(function () {
      setIsLoading(false);
      if (true) {
        setIsSaved(true);
        setLegendList("");
        setSubscriptionPrice("");
        setDescription("");
        setName("");
      } else {
        setIsError(true);
      }
    }, 2000);
  }

  // Function to reset form stage
  function resetFormStage(resetTo: string) {
    setDescription("");
    setName("");
    setIsSaved(false);
    setIsError(false);
    setFormStage(resetTo);
  }

  function resetState() {
    setGeoPoints("");
    setSelectedLayers([]);
    setCurrentlySelectedLayer(null);
    setTempGeoPointsList([]);
    setLastGeoIdRequest(undefined);
    setLastGeoMessageRequest(undefined);
    setLastGeoError(null);
  }

  // Function to update the color of a specific layer
  function updateLayerColor(layerIndex: number, newColor: string) {
    setSelectedLayers(function (prevLayers) {
      const updatedLayers = [...prevLayers];
      updatedLayers[layerIndex].color = newColor;

      setCurrentlySelectedLayer(updatedLayers[layerIndex].id);

      return updatedLayers;
    });
  }

  // Function to update the zone layer status of a specific layer
  function updateLayerZone(layerIndex: number, isZoneLayer: boolean) {
    setSelectedLayers(function (prevLayers) {
      const updatedLayers = [...prevLayers];
      updatedLayers[layerIndex].is_zone_lyr = isZoneLayer;
      setCurrentlySelectedLayer(updatedLayers[layerIndex].id);
      return updatedLayers;
    });
  }

  return (
    <CatalogContext.Provider
      value={{
        formStage,
        saveMethod,
        isLoading,
        isSaved,
        isError,
        selectedCatalog,
        legendList,
        subscriptionPrice,
        description,
        name,
        setFormStage,
        setSaveMethod,
        setIsLoading,
        setIsSaved,
        setIsError,
        setSelectedCatalog,
        setLegendList,
        setSubscriptionPrice,
        setDescription,
        setName,
        handleAddClick,
        handleSave,
        resetFormStage,
        selectedContainerType,
        setSelectedContainerType,
        geoPoints,
        setGeoPoints,
        selectedColor,
        setSelectedColor,
        selectedLayers,
        setSelectedLayers,
        updateLayerColor,
        updateLayerZone,
        currentlySelectedLayer,
        setCurrentlySelectedLayer,
        setTempGeoPointsList,
        openDropdownIndex,
        setOpenDropdownIndex,
        updateLayerDisplay,
        resetState,
      }}
    >
      {children}
    </CatalogContext.Provider>
  );
}

// Hook to use the catalog context
export function useCatalogContext() {
  const context = useContext(CatalogContext);
  if (!context) {
    throw new Error("useCatalogContext must be used within a CatalogProvider");
  }
  return context;
}
