'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const PARAMETER_ALL_VALUE = "All"

  const filterParamPairs = [
    {filter: "REGION_NAME", param: "REGION"},
    {filter: "DISTRICT_NAME", param: "DISTRICT"},
    {filter: "TEAM_NAME", param: "TEAM"},
    {filter: "BRANCH_NAME", param: "BRANCH"},
    {filter: "EMP_NAME", param: "EMP"},
  ]

  let resettingFilters = false;

  $(document).ready(function () {
    tableau.extensions.initializeAsync().then(function () {
      initializeListeners();
    }, function (err) {
      // Something went wrong in initialization.
      console.log('Error while Initializing: ' + err.toString());
    });
  });

  function initializeListeners() {
    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;

    dashboard.worksheets.forEach(function (worksheet) {
      worksheet.addEventListener(tableau.TableauEventType.FilterChanged, filterChangedHandler);
    });
  }

  // This is a handling function that is called anytime a filter is changed in Tableau.
  function filterChangedHandler(filterEvent) {
    if (resettingFilters) {
      return
    }
    try {
      // find parameter this filter is supposed to change
      let pairIndex = findFilterPairIndex(filterEvent.fieldName)
      // if any parameter is found
      if (pairIndex !== null) {
        // get object Filter, pass it to updateParameter
        filterEvent.getFilterAsync().then(filter => {
          updateParameter(filter, pairIndex)
        }).catch(e => {
          console.error(e)
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  function findFilterPairIndex(filterName) {
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
  function updateParameter(filter, pairIndex) {

    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;
    const parameterName = filterParamPairs[pairIndex].param
    dashboard.findParameterAsync(parameterName).then(function (param) {
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
        resetFilters(pairIndex + 1)
      }
    });
  }

  // Accepts
  // * int that states index to start resetting filters from in filterParamPairs array
  function resetFilters(resetFrom) {
    resettingFilters = true;
    try {
      const parameterPromises = [];
      // To get filter info, first get the dashboard.
      const dashboard = tableau.extensions.dashboardContent.dashboard;

      for (let i = resetFrom; i < filterParamPairs.length; i++) {
        parameterPromises.push(dashboard.findParameterAsync(filterParamPairs[i].param))
      }

      Promise.all(parameterPromises).then((returnedParams) => {
        for (let i = 0; i < returnedParams.length; i++) {
          // Reset parameter
          returnedParams[i].changeValueAsync(PARAMETER_ALL_VALUE)

          // Reset filters in every worksheet
          let filterName = filterParamPairs[i + resetFrom].filter

          for (let j = 0; j < dashboard.worksheets.length; j++) {
            dashboard.worksheets[j].clearFilterAsync(filterName).catch(_ => {
              // don't do anything - errors will be thrown for every worksheet that doesn't have the filter
              // todo: this may reset filters on other worksheets than the intended ones. Should this be applied to only one worksheet or to all?
              // todo: it would be better to do it for one specific worksheet to improve performance for bigger projects
            });
          }
        }
      })
    } catch (e) {
      console.error(e)
    } finally {
      resettingFilters = false;
    }
  }
})();
