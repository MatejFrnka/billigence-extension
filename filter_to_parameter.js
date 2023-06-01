'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const filterParamPairs = [{filter: "REGION_NAME", param: "REGION"},
    {filter: "DISTRICT_NAME", param: "DISTRICT"},
    {filter: "TEAM_NAME", param: "TEAM"},
    {filter: "BRANCH_NAME", param: "BRANCH"},
    {filter: "EMP_NAME", param: "EMP"},
  ]

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
    try {
      // find parameter this filter is supposed to change
      let filterPair = findFilterPair(filterEvent.fieldName)
      // if any parameter is found
      if (filterPair !== null) {
        // get object Filter, pass it to updateParameter
        filterEvent.getFilterAsync().then(filter => {
          updateParameter(filter, filterPair)
        }).catch(e => {
          console.error(e)
        })
      }
    } catch (e) {
      console.error(e)
    }
  }

  function findFilterPair(filterName) {
    for (let i = 0; i < filterParamPairs.length; i++) {
      if (filterParamPairs[i].filter === filterName) {
        return filterParamPairs[i].param;
      }
    }
    return null;
  }

  // Accepts
  // * object Filter: https://tableau.github.io/extensions-api/docs/interfaces/filter.html
  // * string with name of the parameter to be updated
  // Updates parameter with given name to value in filter.
  function updateParameter(filter, parameterName) {

    const parameterFetchPromises = [];

    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;

    // check all worksheets for parameter
    dashboard.worksheets.forEach(function (worksheet) {
      parameterFetchPromises.push(worksheet.findParameterAsync(parameterName))
    });


    Promise.all(parameterFetchPromises).then(function (fetchResults) {

      console.log(fetchResults)
      console.log(filter)

      // iterate all found parameters
      for (const i in fetchResults) {
        let param = fetchResults[i]
        // skip if parameter is null
        if (param === null || param === undefined) {
          continue;
        }
        // if filter has multiple values, we only use the first one.
        if (filter.appliedValues.length !== 0) {
          param.changeValueAsync(filter.appliedValues[0].value)
        }
        // if filter is set to select everything, set parameter to all
        else if (filter.isAllSelected === true) {
          console.log("todo, set all")
        } else {
          console.error("Unkown value being set")
        }
      }
    });
  }
})();
