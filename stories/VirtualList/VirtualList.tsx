import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import clsx from 'clsx';
import { throttle } from 'lodash';

import './virtualList.css';
import {
  DEFAULT_MIN_HEIGHT,
  DEFAULT_BUFFER_SIZE,
  ROOT_ELEMENT,
  CHILD_ELEMENT,
  DATASET_ID,
} from './VirtualList.constants';
import { VirtualListProps } from './VirtualList.types';

export const VirtualList = ({
  className,
  minRowHeight = DEFAULT_MIN_HEIGHT,
  bufferSize: upperBufferSize = DEFAULT_BUFFER_SIZE,
  children: upperChildren,
  hasMore = true,
  loading = false,
  onDataRequest = () => undefined,
  onScroll = () => undefined,
  scrollXSubject,
  ...otherProps
}: VirtualListProps) => {
  const [rowHeightMap, setRowHeightMap] = useState(
    () => new Map<number, number>(),
  );

  const isChildrenChanged = useRef(false);

  const children = useMemo(() => {
    isChildrenChanged.current = true;
    return React.Children.toArray(upperChildren);
  }, [upperChildren]);

  const onDataRequest$ = useRef(onDataRequest);
  onDataRequest$.current = onDataRequest;

  const onScroll$ = useRef(onScroll);
  onScroll$.current = onScroll;

  const hasMore$ = useRef(hasMore);
  hasMore$.current = hasMore;

  const minRowHeight$ = useRef(minRowHeight);
  minRowHeight$.current = minRowHeight;

  const loading$ = useRef(loading);
  loading$.current = loading;

  const [elementRefMap] = useState(() => new Map<number, HTMLDivElement>());

  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const bufferSize = useMemo(
    () => Math.max(Math.floor(containerHeight / minRowHeight), upperBufferSize),
    [minRowHeight, upperBufferSize, containerHeight],
  );

  const [resizeObserver] = useState(
    () =>
      new ResizeObserver((entries) =>
        entries.forEach((record) => {
          const element = record.target as HTMLDivElement;
          if (!element) {
            return;
          }
          const { height } = record.contentRect;
          if (element.classList.contains(ROOT_ELEMENT)) {
            setContainerHeight(height);
          }
          if (element.classList.contains(CHILD_ELEMENT)) {
            const elementId = Number(element.dataset[DATASET_ID]);
            if (!Number.isNaN(elementId) && height >= minRowHeight$.current) {
              setRowHeightMap((pendingRowHeightMap) => {
                if (pendingRowHeightMap.get(elementId) !== height) {
                  pendingRowHeightMap.set(elementId, height);
                  return new Map(pendingRowHeightMap);
                }
                return pendingRowHeightMap;
              });
            }
          }
        }),
      ),
  );

  const getStartIndex = useCallback(
    (pendingScrollPosition: number) => {
      let startScrollPos = pendingScrollPosition;
      let idx = 0;
      children.forEach(() => {
        if (startScrollPos >= 0) {
          startScrollPos -= rowHeightMap.get(idx) || minRowHeight;
          idx += 1;
        }
      });
      return Math.max(idx - bufferSize, 0);
    },
    [bufferSize, rowHeightMap, minRowHeight, children],
  );

  const getEndIndex = useCallback(
    (pendingScrollPosition: number, totalLength: number) => {
      let endScrollPos = pendingScrollPosition + containerHeight;
      let idx = 0;
      children.forEach(() => {
        if (endScrollPos >= 0) {
          endScrollPos -= rowHeightMap.get(idx) || minRowHeight;
          idx += 1;
        }
      });
      return Math.min(idx - 1 + bufferSize, totalLength - 1);
    },
    [children, containerHeight, bufferSize, rowHeightMap, minRowHeight],
  );

  const getTopPos = useCallback(
    (elementIndex: number) => {
      let totalTop = 0;
      children.slice(0, elementIndex).forEach((_, idx) => {
        totalTop += rowHeightMap.get(idx) || minRowHeight;
      });
      return totalTop;
    },
    [children, rowHeightMap, minRowHeight],
  );

  const getBottomReached = useCallback(() => {
    if (container) {
      if (container.clientHeight >= container.scrollHeight) {
        return false;
      }
      return (
        Math.abs(
          container.scrollHeight - container.scrollTop - container.clientHeight,
        ) < 10
      );
    }
    return false;
  }, [container]);

  const scrollAdjust = useMemo(() => {
    let totalHeight = 0;
    children.forEach((_, idx) => {
      totalHeight += rowHeightMap.get(idx) || minRowHeight;
    });
    return totalHeight;
  }, [rowHeightMap, minRowHeight, children]);

  const visibleChildren = useMemo(() => {
    const startIndex = getStartIndex(scrollPosition);
    const endIndex = getEndIndex(scrollPosition, children.length);

    [...elementRefMap.entries()].forEach(([index, element]) => {
      if (index < startIndex || index > endIndex) {
        resizeObserver.unobserve(element);
        elementRefMap.delete(index);
      }
    });

    let isBottomReached = true;
    isBottomReached = isBottomReached && hasMore$.current;
    isBottomReached = isBottomReached && !loading$.current;
    isBottomReached = isBottomReached && getBottomReached();
    isBottomReached = isBottomReached && children.length === endIndex + 1;

    if (isBottomReached && !isChildrenChanged.current) {
      queueMicrotask(() => onDataRequest$.current(false));
    }

    isChildrenChanged.current = false;

    return children.slice(startIndex, endIndex + 1).map((child, index) =>
      React.cloneElement(child as React.ReactElement, {
        ref: (element: HTMLDivElement | null) => {
          if (!element) {
            return;
          }
          const elementIdx = startIndex + index;
          const prevElement = elementRefMap.get(elementIdx);
          if (element === prevElement) {
            return;
          }
          if (prevElement) {
            resizeObserver.unobserve(prevElement);
          }
          element.classList.add(CHILD_ELEMENT);
          // eslint-disable-next-line no-param-reassign
          element.dataset[DATASET_ID] = String(elementIdx);
          resizeObserver.observe(element);
          elementRefMap.set(elementIdx, element);
          setRowHeightMap((pendingRowHeightMap) => {
            let isChanged = true;
            isChanged = isChanged && element.offsetHeight >= minRowHeight;
            isChanged =
              isChanged &&
              pendingRowHeightMap.get(elementIdx) !== element.offsetHeight;
            if (isChanged) {
              pendingRowHeightMap.set(elementIdx, element.offsetHeight);
              return new Map(pendingRowHeightMap);
            }
            return pendingRowHeightMap;
          });
        },
        style: {
          position: 'absolute',
          top: getTopPos(startIndex + index),
          minHeight: minRowHeight,
          minWidth: '100%',
          left: 0,
        },
      }),
    );
  }, [
    hasMore$,
    loading$,
    children,
    minRowHeight,
    scrollPosition,
    getStartIndex,
    getEndIndex,
    getTopPos,
    getBottomReached,
    onDataRequest$,
    elementRefMap,
    resizeObserver,
  ]);

  const handleRef = useCallback((element: HTMLDivElement | null) => {
    if (element) {
      element.addEventListener(
        'scroll',
        throttle(
          () => {
            setScrollPosition(element.scrollTop);
          },
          50,
          {
            leading: true,
          },
        ),
      );
      element.addEventListener('scroll', () =>
        onScroll$.current(element.scrollLeft, element.scrollTop),
      );
      setContainerHeight(element.offsetHeight);
      if (scrollXSubject) {
        scrollXSubject.subscribe((scrollX) => {
          if (element.scrollLeft !== scrollX) {
            element.scrollTo(
              Math.min(scrollX, element.scrollWidth),
              element.scrollTop,
            );
          }
        });
      }
      setContainer(element);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(
    () => () => {
      resizeObserver.disconnect();
    },
    [resizeObserver],
  );

  useEffect(() => {
    onDataRequest$.current(true);
  }, []);

  return (
    <div
      className={clsx(className, "root", ROOT_ELEMENT)}
      {...otherProps}
      ref={handleRef}
    >
      {visibleChildren}
      <div
        className={"adjust"}
        style={{
          top: scrollAdjust,
        }}
      />
    </div>
  );
};

export default VirtualList;
