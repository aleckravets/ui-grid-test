var app = angular.module('app', [
    'ngTouch',
    "ui.grid",
    "ui.grid.edit",
    "ui.grid.cellNav",
    "ui.grid.resizeColumns",
    "ui.grid.selection",
    "ui.grid.pagination",
    "ui.grid.infiniteScroll",
    "ui.grid.pinning"

]);

const columnTypeParamName = "columnType";
const columnWidthParamName = "columnWidth";
const columnAutoWidthParamName = "columnAutoWidth";
const minColumnWidth = 95;

app.run(function($templateCache) {
    $templateCache.put('ui-grid/uiGridViewport',
        `<div role=\"rowgroup\" class=\"ui-grid-viewport\" ng-style=\"colContainer.getViewportStyle()\">
            <div class=\"ui-grid-canvas\" viewport-renderer ng-if="rowContainer.renderedRows.length">
                <!--<div ng-repeat=\"(rowRenderIndex, row) in rowContainer.renderedRows track by $index\" class=\"ui-grid-row\" ng-style=\"Viewport.rowStyle(rowRenderIndex)\">-->
                    <!--<div role=\"row\" ui-grid-row=\"row\" row-render-index=\"rowRenderIndex\"></div>-->
                <!--</div>-->
            </div>
        </div>`
    );

});

app.directive("viewportRenderer", function($compile) {
   return {
       controller: function($scope) {
           // console.log($scope, $scope.rowContainer);
           // $scope.$watch(() => $scope.rowContainer, rowContainer => {
           //    if (rowContainer) {
           //        console.log(rowContainer);
           //    }
           // });
       },
       link: function($scope, iElem, attrs) {
           // $scope.$watch(() => $scope.rowContainer.renderedRows, val => {
           //     compile();
           // });

           setTimeout(function() {
               compile();
           })


           function compile() {
               for (var rowRenderIndex in $scope.rowContainer.renderedRows) {
                   var row = $scope.rowContainer.renderedRows[rowRenderIndex];
                   const rowElement = angular.element(`
                        <div class="ui-grid-row" ng-style1="Viewport.rowStyle(${rowRenderIndex})">
                            <div role="row" ui-grid-row="rowContainer.renderedRows[${rowRenderIndex}]" row-render-index="${rowRenderIndex}"></div>
                        </div>`);
                   iElem.append($compile(rowElement)($scope));
               }

           }
       }

   }
});


app.controller('MainCtrl', ['$scope', '$http', '$q', function ($scope, $http, $q) {
    const groups = [];

    function getGridData(entities) {
        const gridData = [];
        var lastGroupName = {};
        entities.forEach(entity => {
            var isFirstInGroup = false;

            // add group headers
            groups.forEach(g => {
                const groupName = entity.Position && entity.Position[g.propertyName];
                if (groupName && groupName !== lastGroupName[g.level]) {
                    isFirstInGroup = true;
                    gridData.push({
                        isGroupHeader: true,
                        groupName,
                        level: g.level,
                        columnSpan: g.columnSpan
                    });
                    lastGroupName[g.level] = groupName;
                    Object.keys(lastGroupName).forEach((level) => {
                        if (level > g.level) lastGroupName[level] = undefined;
                    });
                }
            });

            // add entity
            gridData.push({
                isGroupHeader: false,
                entity,
                isFirstInGroup
            });
        });

        return gridData;
    }

    $http.get('new-business-layout.json')
        .then(function(response) {
            const typeLayout = response.data;

            const pinnedColumns = typeLayout.propertyLayouts.filter(pl => pl.displayDirectiveParameters[columnTypeParamName] === "RowHeader");

            // add group configuration for entities that have a Position property
            if (typeLayout.propertyLayouts.filter(pl => pl.systemName === "Position").length > 0) {
                groups.push({
                    propertyName: "GroupName",
                    level: 1,
                    columnSpan: pinnedColumns.length || 2
                });
            }

            $scope.groupHeaderColContainerName =  pinnedColumns.length > 0 ? "left" : "body";


            $scope.gridOptions = {
                enablePinning: true,
                enableSorting: false,
                enablePaging: false,
                enableFiltering: false,
                enableFullRowSelection: true,
                enableSelectAll: false,
                enableGridMenu: true,
                enableRowSelection: false,
                rowHeight: 27,
                virtualizationThreshold: 1000,
                typeLayout,
                rowTemplate: `
                <div ng-if="row.entity.isGroupHeader && colContainer.name === row.grid.appScope.groupHeaderColContainerName" class="group-header-row level-{{row.entity.level}}" ng-init="row.entity.entity = {}">
                    <div class="ui-grid-cell group-header-name">{{row.entity.groupName}}</div>
                    <div ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns | limitTo: row.entity.columnSpan track by col.uid" 
                         ui-grid-one-bind-id-grid="rowRenderIndex + '-' + col.uid + '-cell'"
                         class="ui-grid-cell"
                         ui-grid-cell>
                    </div>
                </div>
                <div ng-if="!row.entity.isGroupHeader">
                    <div ng-repeat="(colRenderIndex, col) in colContainer.renderedColumns track by col.uid" 
                         ui-grid-one-bind-id-grid="rowRenderIndex + '-' + col.uid + '-cell'" 
                         class="ui-grid-cell" ng-class="{ 'ui-grid-row-header-cell': col.isRowHeader }" 
                         role="{{col.isRowHeader ? 'rowheader' : 'gridcell'}}" 
                         ui-grid-cell>
                    </div>
                </div>
                `
            };

            $scope.gridOptions.columnDefs = typeLayout.propertyLayouts
                .filter(pl => pl.isVisible && pl.isSimple)
                .map(pl => {
                    const width = pl.displayDirectiveParameters[columnAutoWidthParamName] ? '*'
                        : Math.max(minColumnWidth, pl.displayDirectiveParameters[columnWidthParamName] || (pl.displayName == 'Position' ? 300 :  pl.displayName.length * 10)); //each character multiplied by 10 pixels

                    return {
                        field: `entity.${pl.systemName}`,
                        enableColumnResizing: true,
                        pinnedLeft: pl.displayDirectiveParameters.columnType === 'RowHeader',
                        width,
                        cellClass,
                        propertyLayout: pl
                    }
                });
        })
        .then(() => {
            $http.get('new-business.json')
                .then(response => {
                    const data = response.data;
                    $scope.gridOptions.data = getGridData(data.value.slice(0, 377));
                });
        });
}]);

function cellClass(grid, row, col, rowRenderIndex, colRenderIndex) {
    const entity = row.entity.entity;
    const propertyLayout = col.colDef.propertyLayout;

    var cl = '';

    if (row.entity.isFirstInGroup) cl += ' first-in-group';

    if (!row.entity.isGroupHeader) {
        if (isEditableProperty(grid.options.typeLayout, entity, propertyLayout)) cl += ' editable-cell';

        if (entity.IsEditable) cl += ' editable-row-cell';

        if (entity.Position && entity.Position.PositionType) {
            var typeClass = entity.Position.PositionType.toLowerCase();
            // todo: temporary solution, until we have a isAggregated flag coming from the backend
            // const isReportingUnit = (<any>$scope.reportingNode).getType().name === 'ReportingUnit';
            // if (!isReportingUnit && typeClass == 'input') typeClass = 'external';

            cl += ' row-type-' + typeClass;
        }

        if (propertyLayout.displayDirectiveParameters[columnTypeParamName])
            cl += ' col-type-' + propertyLayout.displayDirectiveParameters[columnTypeParamName].toLowerCase();
    }

    if (cl) return cl;
}

function isEditableProperty(typeLayout, entity, pl) {
    return typeLayout.isEditable && entity.IsEditable && pl.isEditable;
}