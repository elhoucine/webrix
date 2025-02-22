/**
 * Copyright (c) 2020, Amdocs Corp.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import classNames from 'classnames';
import {copyComponentRef, findChildByType} from 'utility/react';
import {isEqual} from 'utility/object';
import ResizeObserver from 'tools/ResizeObserver';
import {VerticalScrollbarPlaceholder, HorizontalScrollbarPlaceholder, VerticalScrollbar, HorizontalScrollbar} from './components';
import {propTypes, defaultProps} from './Scrollable.props';
import {SCROLLING_CLASS_REMOVAL_DELAY} from './Scrollable.constants';
import './Scrollable.scss';

export default class Scrollable extends React.PureComponent {

    static propTypes = propTypes;
    static defaultProps = defaultProps;

    constructor(props) {
        super(props);
        this.container = React.createRef();
        this.horizontal = React.createRef();
        this.vertical = React.createRef();
        this.event = {prev: {}, next: {}};
    }

    getSnapshotBeforeUpdate() {
        const {scrollTop, scrollLeft} = this.container.current;
        return {scrollTop, scrollLeft};
    }

    componentDidMount() {
        this.updateScrollbars();
    }

    componentDidUpdate(prevProps, prevState, {scrollTop, scrollLeft}) {
        if (!this.props.scrollOnDOMChange) {
            // Sometimes DOM changes trigger a scroll by the browser.
            // On the other hand, we sometimes use the onScroll event to
            // make DOM changes. Clearly, when the two occur together,
            // it can lead to an infinite loop, since  the browser will
            // trigger another onScroll that will trigger another DOM change and so on.
            // To solve this, we get the snapshot before the DOM is updated
            // and check for a mismatch between the scrollTop before and after.
            // If such a mismatch exists, it means that the scroll
            // was done by the browser, and not the user, and therefore
            // we apply the scrollTop from the snapshot.
            this.container.current.scrollTop = scrollTop;
            this.container.current.scrollLeft = scrollLeft;
        }

        // While the <ResizeObserver/> observes dimension changes on the container,
        // this part observes changes to the dimensions of the content.
        this.updateScrollbars();
    }

    handleOnScroll = e => {
        const container = this.container.current;

        this.updateScrollbars();
        this.props.onScroll(this.event.next);

        if (e.target === container) { // Avoid adding this className on ancestors, since the scroll event bubbles up
            container.parentElement.classList.add('scrolling');
            clearTimeout(this.timeout);
            this.timeout = setTimeout(() => {
                container.parentElement.classList.remove('scrolling');
            }, SCROLLING_CLASS_REMOVAL_DELAY);
        }
    };

    getEvent = () => {
        if (!this.container.current) {
            return {};
        }

        const container = this.container.current;
        const {clientHeight, clientWidth, scrollTop: st, scrollLeft: sl, scrollHeight, scrollWidth} = container;
        const scrollTop = Math.ceil(st);
        const scrollLeft = Math.ceil(sl);

        return {
            top: Math.min(1, scrollTop / Math.max(1, scrollHeight - clientHeight)),
            left: Math.min(1, scrollLeft / Math.max(1, scrollWidth - clientWidth)),
            scrollTop,
            scrollLeft,
            scrollHeight,
            scrollWidth,
            clientHeight,
            clientWidth,
        };
    };

    updateScrollbars = () => {
        this.event.next = this.getEvent();
        // This check ensures that updates (which are a potentially expensive operation)
        // are only executed if the applicable scroll properties have changed
        if (!isEqual(this.event.prev, this.event.next)) {
            this.vertical.current.update();
            this.horizontal.current.update();
            this.props.onUpdate(this.event.next);
        }
        this.event.prev = this.event.next;
    };

    getElementProps = () => {
        const {element} = this.props;
        return {
            className: classNames('scrollbar-inner', element.props.className),
            ref: copyComponentRef(element.ref, this.container),
            onScroll: this.handleOnScroll,
        }
    };

    handleOnTransitionEnd = e => {
        // Sometimes internal dimension changes don't occur immediately due to transitions/animations.
        // These changes are not detected by the <ResizeObserver/> since they are internal, and are
        // detected too early by getSnapshotBeforeUpdate() since the transition/animation is completed
        // some time after the DOM change. This handler covers for that.
        if ('height' === e.propertyName || 'width' === e.propertyName) {
            this.updateScrollbars();
        }
    };

    render() {
        const {children, style, element} = this.props;
        const vsb = findChildByType(children, VerticalScrollbarPlaceholder);
        const hsb = findChildByType(children, HorizontalScrollbarPlaceholder);
        const content = React.Children.toArray(children).filter(child => ![VerticalScrollbarPlaceholder, HorizontalScrollbarPlaceholder].includes(child.type));
        return (
            <ResizeObserver onResize={this.updateScrollbars}>
                <div className='scrollbar' style={style} onTransitionEnd={this.handleOnTransitionEnd}>
                    {React.cloneElement(element, this.getElementProps(), content)}
                    {React.cloneElement(vsb ? vsb.props.children : <VerticalScrollbar/>, {ref: this.vertical, container: this.container})}
                    {React.cloneElement(hsb ? hsb.props.children : <HorizontalScrollbar/>, {ref: this.horizontal, container: this.container})}
                </div>
            </ResizeObserver>
        );
    }
}
