'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const PARAMETER_ALL_VALUE = "All"
  const CONFIGURE_PATH = `/billigence-extension/config.html`;

  let resettingFilters = false;

  function getFilterParamPairs() {
    const pairsString = tableau.extensions.settings.get("pairs")
    return JSON.parse(pairsString);
  }

  $(document).ready(function () {
    tableau.extensions.initializeAsync({'configure': configure}).then(function () {
      initializeListeners();
    }, function (err) {
      // Something went wrong in initialization.
      console.error('Error while Initializing: ' + err.toString());
    });
  });

  function configure() {
    const popupUrl = `${window.location.origin}${CONFIGURE_PATH}`;

    tableau.extensions.ui.displayDialogAsync(popupUrl, 10, {
      height: 500,
      width: 680
    }).catch((error) => {
      if (error.errorCode !== tableau.ErrorCodes.DialogClosedByUser) {
        console.error(error)
      }
    });
  }

  function initializeListeners() {
    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;

    dashboard.worksheets.forEach(function (worksheet) {
      worksheet.addEventListener(tableau.TableauEventType.FilterChanged, filterChangedHandler);
    });
  }

  // This is a handling function that is called anytime a filter is changed in Tableau.
  async function filterChangedHandler(filterEvent) {
    if (resettingFilters) {
      return
    }
    try {
      // find parameter this filter is supposed to change
      let pairIndex = findFilterPairIndex(filterEvent.fieldName)
      // if any parameter is found
      if (pairIndex !== null) {
        // get object Filter, pass it to updateParameter
        let filter = await filterEvent.getFilterAsync()
        await updateParameter(filter, pairIndex)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function findFilterPairIndex(filterName) {
    const filterParamPairs = getFilterParamPairs();
    for (let i = 0; i < filterParamPairs.length; i++) {
      if (filterParamPairs[i].filter === filterName) {
        return i;
      }
    }
    return null;
  }

  // Accepts
  // * object Filter: https://tableau.github.io/extensions-api/docs/interfaces/filter.html
  // * string with name of the parameter to be updated
  // Updates parameter with given name to value in filter.
  async function updateParameter(filter, pairIndex) {

    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const parameterName = getFilterParamPairs()[pairIndex].param
    let param = await dashboard.findParameterAsync(parameterName)
    // skip if parameter is null
    if (!(param === null || param === undefined)) {
      if (filter.isAllSelected !== true && filter.appliedValues.length !== 0) {
        param.changeValueAsync(filter.appliedValues[0].value)
      } else if (filter.isAllSelected === true) {
        // if filter is set to select everything, set parameter to all
        param.changeValueAsync(PARAMETER_ALL_VALUE)
      } else {
        console.error("Unkown value being set")
      }
      await resetFilters(pairIndex + 1)
    }
  }

  // Accepts
  // * int that states index to start resetting filters from in filterParamPairs array
  async function resetFilters(resetFrom) {
    resettingFilters = true;
    const filterParamPairs = getFilterParamPairs();
    try {
      const parameterPromises = [];
      // To get filter info, first get the dashboard.
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      for (let i = resetFrom; i < filterParamPairs.length; i++) {
        parameterPromises.push(dashboard.findParameterAsync(filterParamPairs[i].param))
      }

      let returnedParams = await Promise.all(parameterPromises);
      for (let i = 0; i < returnedParams.length; i++) {
        // Reset parameter
        returnedParams[i].changeValueAsync(PARAMETER_ALL_VALUE)
          .catch(_ => alert(`Parameter ${returnedParams[i].name}, (id: ${returnedParams[i].id}) cannot be reset to value ${PARAMETER_ALL_VALUE}`))

        // Reset filters in every worksheet
        let filterName = filterParamPairs[i + resetFrom].filter

        for (let j = 0; j < dashboard.worksheets.length; j++) {
          dashboard.worksheets[j].clearFilterAsync(filterName).catch(_ => {
            // don't do anything - errors will be thrown for every worksheet that doesn't have the filter
            // this may reset filters on other worksheets than the intended ones. Should this be applied to only one worksheet or to all?
            // it would be better to do it for one specific worksheet to improve performance for bigger projects
          });
        }
      }
    } catch (e) {
      console.error(e)
    } finally {
      resettingFilters = false;
    }
  }
})();
