export interface TSubject<Data = unknown> {
  subscribe: (callback: (data: Data) => void) => () => void;
  once: (callback: (data: Data) => void) => () => void;
  next: (data: Data) => void;
}


export interface VirtualListProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onScroll'> {
  /**
   * Блокирует вызов onDataRequest, если true
   */
  loading?: boolean;
  /**
   * Блокирует вызов onDataRequest, если false
   */
  hasMore?: boolean;
  /**
   * Минимальная высота строки для использования виртуализации.
   * Чем ближе значение к реальному, тем быстрее работает виртуализация
   */
  minRowHeight?: number;
  /**
   * Размер буффера для виртуализации
   */
  bufferSize?: number;
  /**
   * Subject для прокрутке слева-направо из вышестоящего компонента
   */
  scrollXSubject?: TSubject<number>;
  /**
   * Вызывается при достижении конца списка, если не loading и hasMore
   */
  onDataRequest?: (initial: boolean) => void;
  /**
   * Вызывается просле скролла списка
   */
  onScroll?: (scrollX: number, scrollY: number) => void;
  children: React.ReactNode;
}
