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

app.controller('MainCtrl', function ($scope, $http, $q, $templateCache) {
    const groups = [];

    function getRowClasses(entity, isFirstInGroup) {
        var cl = '';

        // if (row.grid.appScope.isEditableProperty(grid.options.typeLayout, entity, propertyLayout)) cl += ' editable-cell';

        // if (entity.IsEditable) cl += ' editable-row-cell';

        if (isFirstInGroup) cl += ' first-in-group';

        if (entity.Position && entity.Position.PositionType) {
            var typeClass = entity.Position.PositionType.toLowerCase();
            // todo: temporary solution, until we have a isAggregated flag coming from the backend
            // const isReportingUnit = (<any>$scope.reportingNode).getType().name === 'ReportingUnit';
            // if (!isReportingUnit && typeClass == 'input') typeClass = 'external';

            cl += ' row-type-' + typeClass;
        }

        return cl.trim();
    }

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
                isFirstInGroup,
                classes: getRowClasses(entity, isFirstInGroup)
            });
        });

        return gridData;
    }

    $http.get('new-business-layout.json')
        .then(response => {
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
                // virtualizationThreshold: 100,
                typeLayout,
                rowTemplate1: `
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
                `,
                rowTemplate: `<div static-row></div>`
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
                    $scope.gridOptions.data = getGridData(data.value.slice(0, 300));

                    this.changeData = (start, end) => this.data = data.value.slice(start, end);
                });
        });


    // $templateCache.put('ui-grid/uiGridViewport',
    //     `<div role="rowgroup" class="ui-grid-viewport" ng-style="colContainer.getViewportStyle()"><!-- tbody -->
    //         <div class="ui-grid-canvas">
    //             <div ng-repeat="(rowRenderIndex, row) in rowContainer.renderedRows" class="ui-grid-row" ng-style="Viewport.rowStyle(rowRenderIndex)">
    //                 <div role="row" ui-grid-row="row" row-render-index="rowRenderIndex"></div>
    //             </div>
    //         </div>
    //     </div>`
    // );

});


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

app.directive(
    "logDomCreation",
    function() {
        return({
            compile() {
                // console.log('compile');

                return {
                    // pre: ($scope) => console.log('pre' + $scope.$index),
                    post: ($scope) => console.log('post' + $scope.$index)
                }
            },
            controller($scope) {
                // console.log('controller ' + $scope.$index)
            }
        });
    }
);

app.directive("staticRow", function($compile) {

    const cache = {};

    return {
        // scope: false,
        link($scope, element, attrs) {
            console.log(`link ${$scope.rowRenderIndex}`);

            const isVirtualizationEnabled = true;//$scope.colContainer.visibleRowCache.length > $scope.grid.options.virtualizationThreshold;

            const isLeftContainer = $scope.colContainer.name === 'left';

            if (!cache[$scope.colContainer.name]) {
                let renderedColumns = isLeftContainer ? $scope.colContainer.renderedColumns.slice(0, 2) : $scope.colContainer.renderedColumns;
                cache[$scope.colContainer.name] = getColsHtml(renderedColumns);
            }

            const colsHtml = cache[$scope.colContainer.name];

            const classBinding = (isVirtualizationEnabled ? '' : '::') + 'row.entity.classes';

            var rowHtml = `<div ng-if="!row.entity.isGroupHeader" ng-class="${classBinding}">${colsHtml}</div>`;

            if (isLeftContainer) {
                rowHtml += `
                    <div ng-if="row.entity.isGroupHeader" class="group-header-row level-{{row.entity.level}}">
                        <div class="ui-grid-cell group-header-name">{{row.entity.groupName}}</div>
                        ${colsHtml}
                    </div>`;
            }

            const innerElement = angular.element(rowHtml);

            element.append(innerElement);

            $compile(innerElement)($scope);

            function getColsHtml(renderedColumns) {
                console.log(`compile columns html for ${$scope.colContainer.name}`);
                return renderedColumns.map((col, colRenderIndex) => {
                    var classes = col.getColClass(false) + getColClasses(col.colDef.propertyLayout);

                    const valueBinding = (isVirtualizationEnabled ? '' : '::') + `row.entity.${col.colDef.field}`;
                    const propertyTemplate = `<div ng-bind="${valueBinding}"></div>`;
                    const cellTemplate = `<div class="relative-position" ng-controller1="staticCellController" inline-edit>${propertyTemplate}</div>`
                    // const propertyTemplate = entityService.getPropertyTemplate($scope.grid.options.typeLayout, col.colDef.propertyLayout, constantService.detailsModes.display, false);

                    // todo: check what this directive is needed for and see what we can do with missing rowRenderIndex
                    // ui-grid-one-bind-id-grid="'${rowRenderIndex}-${col.uid}-cell'"
                    return `<div class="ui-grid-cell ${classes}">${cellTemplate}</div>`;
                }).join('');
            }
        }
    }
});

function getColClasses(propertyLayout) {
    var cl = '';
    if (propertyLayout.displayDirectiveParameters.columnType)
        cl += ' col-type-' + propertyLayout.displayDirectiveParameters.columnType.toLowerCase();
    return cl;
}