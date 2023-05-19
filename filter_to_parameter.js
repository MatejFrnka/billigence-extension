'use strict';

// Wrap everything in an anonymous function to avoid polluting the global namespace
(function () {

  const filterParamPairs = [
    {filter: "REGION_NAME", param: "REGION"},
    {filter: "DISTRICT_NAME", param: "DISTRICT"},
    {filter: "TEAM_NAME", param: "TEAM"},
    {filter: "BRANCH_NAME", param: "BRANCH"},
    {filter: "EMP_NAME", param: "EMP"},
  ]

  const unregisterHandlerFunctions = [];

  $(document).ready(function () {
    tableau.extensions.initializeAsync().then(function () {
      fetchFilters();

      // Add button handlers for clearing filters.
      $('#clear').click(clearAllFilters);
    }, function (err) {
      // Something went wrong in initialization.
      console.log('Error while Initializing: ' + err.toString());
    });
  });

  function fetchFilters () {
    // While performing async task, show loading message to user.
    $('#loading').addClass('show');

    // Whenever we restore the filters table, remove all save handling functions,
    // since we add them back later in this function.
    unregisterHandlerFunctions.forEach(function (unregisterHandlerFunction) {
      unregisterHandlerFunction();
    });

    // Since filter info is attached to the worksheet, we will perform
    // one async call per worksheet to get every filter used in this
    // dashboard.  This demonstrates the use of Promise.all to combine
    // promises together and wait for each of them to resolve.
    const filterFetchPromises = [];


    // List of all filters in a dashboard.
    const dashboardfilters = [];

    // To get filter info, first get the dashboard.
    const dashboard = tableau.extensions.dashboardContent.dashboard;

    // Then loop through each worksheet and get its filters, save promise for later.
    dashboard.worksheets.forEach(function (worksheet) {
      filterFetchPromises.push(worksheet.getFiltersAsync());

      // Add filter event to each worksheet.  AddEventListener returns a function that will
      // remove the event listener when called.
      const unregisterHandlerFunction = worksheet.addEventListener(tableau.TableauEventType.FilterChanged, filterChangedHandler);
      unregisterHandlerFunctions.push(unregisterHandlerFunction);
    });

    // Now, we call every filter fetch promise, and wait for all the results
    // to finish before displaying the results to the user.
    Promise.all(filterFetchPromises).then(function (fetchResults) {
      fetchResults.forEach(function (filtersForWorksheet) {
        filtersForWorksheet.forEach(function (filter) {
          dashboardfilters.push(filter);
        });
      });
      console.log(dashboardfilters)
      buildFiltersTable(dashboardfilters);
    });
  }

  // This is a handling function that is called anytime a filter is changed in Tableau.
  function filterChangedHandler (filterEvent) {
    // Just reconstruct the filters table whenever a filter changes.
    // This could be optimized to add/remove only the different filters.
    try {
    
    // find parameter this filter is supposed to change
    let filterPair = findFilterPair(filterEvent.fieldName)
    // if any parameter is found
    if(filterPair !== null){
      // get object Filter, pass it to updateParameter
      filterEvent.getFilterAsync().then(filter => {
        updateParameter(filter, filterPair)
      }).catch(e=>{console.error(e)})
    }

    fetchFilters();    

    }
    catch(e){
      console.log(e)
    }
  }

  function findFilterPair(filterName){
    for (let i = 0; i < filterParamPairs.length; i++){
      if (filterParamPairs[i].filter == filterName){
        var tmp =  filterParamPairs[i].param;
        return tmp;
      }
    }
    return null;
  }

  // Constructs UI that displays all the dataSources in this dashboard
  // given a mapping from dataSourceId to dataSource objects.
  function buildFiltersTable (filters) {
    // Clear the table first.
    $('#filtersTable > tbody tr').remove();
    const filtersTable = $('#filtersTable > tbody')[0];

    filters.forEach(function (filter) {
      const newRow = filtersTable.insertRow(filtersTable.rows.length);
      const nameCell = newRow.insertCell(0);
      const worksheetCell = newRow.insertCell(1);
      const typeCell = newRow.insertCell(2);
      const valuesCell = newRow.insertCell(3);

      const valueStr = getFilterValues(filter);

      nameCell.innerHTML = filter.fieldName;
      worksheetCell.innerHTML = filter.worksheetName;
      typeCell.innerHTML = filter.filterType;
      valuesCell.innerHTML = valueStr;
    });

    updateUIState(Object.keys(filters).length > 0);
  }

  // This returns a string representation of the values a filter is set to.
  // Depending on the type of filter, this string will take a different form.
 
  function getFilterValues (filter) {
    let filterValues = '';

    switch (filter.filterType) {
      case 'categorical':
        filter.appliedValues.forEach(function (value) {
          filterValues += value.formattedValue + ', ';
        });
        break;
      case 'range':
        // A range filter can have a min and/or a max.
        if (filter.minValue) {
          filterValues += 'min: ' + filter.minValue.formattedValue + ', ';
        }

        if (filter.maxValue) {
          filterValues += 'max: ' + filter.maxValue.formattedValue + ', ';
        }
        break;
      case 'relative-date':
        filterValues += 'Period: ' + filter.periodType + ', ';
        filterValues += 'RangeN: ' + filter.rangeN + ', ';
        filterValues += 'Range Type: ' + filter.rangeType + ', ';
        break;
      default:
      }

    // Cut off the trailing ", "
    return filterValues.slice(0, -2);

  
  }


  // This function removes all filters from a dashboard.
  function clearAllFilters () {
    // While performing async task, show loading message to user.
    $('#loading').removeClass('hidden').addClass('show');
    $('#filtersTable').removeClass('show').addClass('hidden');

    const dashboard = tableau.extensions.dashboardContent.dashboard;

    dashboard.worksheets.forEach(function (worksheet) {
      worksheet.getFiltersAsync().then(function (filtersForWorksheet) {
        const filterClearPromises = [];

        filtersForWorksheet.forEach(function (filter) {
          filterClearPromises.push(worksheet.clearFilterAsync(filter.fieldName));
        });

        // Same pattern as in fetchFilters, wait until all promises have finished
        // before updating the UI state.
        Promise.allSettled(filterClearPromises).then(function () {
          updateUIState(false);
        });
      });
    });
  }

  // This helper updates the UI depending on whether or not there are filters
  // that exist in the dashboard.  Accepts a boolean.
  function updateUIState (filtersExist) {
    $('#loading').addClass('hidden');
    if (filtersExist) {
      $('#filtersTable').removeClass('hidden').addClass('show');
      $('#noFiltersWarning').removeClass('show').addClass('hidden');
    } else {
      $('#noFiltersWarning').removeClass('hidden').addClass('show');
      $('#filtersTable').removeClass('show').addClass('hidden');
    }
  }

  // Accepts 
  // * object Filter: https://tableau.github.io/extensions-api/docs/interfaces/filter.html
  // * string with name of the parameter to be updated
  // Updates parameter with given name to value in filter.
  function updateParameter(filter, parameterName){

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
        if (param === null || param === undefined){
          continue;
        }
        // if filter has multiple values, we only use the first one. 
        if (filter.appliedValues.length != 0){
          param.changeValueAsync(filter.appliedValues[0].value) 
        }
        // if filter is set to select everything, set parameter to all
        else if(filter.isAllSelected === true){
          console.log("todo, set all")
        }
        else{
          console.error("Unkown value being set")
        }
      }
    });
  }

  function myFunction() {
    document.getElementById("my-div").innerHTML = "Hodnota x je: " + getFilterValues(filter);
  }
})();
