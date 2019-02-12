import React from "react";
import PropTypes from "prop-types";
import classes from "classnames";
import i18n from "@dhis2/d2-i18n";

const noop = () => {};

class Pagination extends React.Component {
    static propTypes = {
        hasPreviousPage: PropTypes.func,
        hasNextPage: PropTypes.func,
        onPreviousPageClick: PropTypes.func,
        onNextPageClick: PropTypes.func,
        total: PropTypes.number,
        currentlyShown: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    };

    static defaultProps = {
        hasPreviousPage: noop,
        hasNextPage: noop,
        onPreviousPageClick: noop,
        onNextPageClick: noop,
        total: 0,
        currentlyShown: 0,
    };

    render() {
        const {
            hasPreviousPage,
            hasNextPage,
            onPreviousPageClick,
            onNextPageClick,
            currentlyShown,
            total,
        } = this.props;
        const pagerButtonClasses = ["material-icons", "waves-effect"];

        const previousPageClasses = classes(pagerButtonClasses, {
            "data-table-pager--previous-page__disabled": !hasPreviousPage(),
        });
        const nextPageClasses = classes(pagerButtonClasses, {
            "data-table-pager--next-page__disabled": !hasNextPage(),
        });

        return (
            <div className="data-table-pager">
                <ul className="data-table-pager--buttons">
                    {total ? (
                        <li className="data-table-pager--page-info">
                            <span>
                                {currentlyShown} {`${i18n.t("of")}`} {total}
                            </span>
                        </li>
                    ) : (
                        ""
                    )}
                    <li className="data-table-pager--previous-page">
                        <i
                            className={previousPageClasses}
                            onClick={hasPreviousPage() ? onPreviousPageClick : noop}
                        >
                            navigate_before
                        </i>
                    </li>
                    <li className="data-table-pager--next-page">
                        <i
                            className={nextPageClasses}
                            onClick={hasNextPage() ? onNextPageClick : noop}
                        >
                            navigate_next
                        </i>
                    </li>
                </ul>
            </div>
        );
    }
}

export default Pagination;
