import { VirtualList } from './VirtualList';
import mock from './VirtualTable.mock';


const meta = {
  title: 'Example/VirtualList',
  component: VirtualList,
 
};

export default meta;

export const OneItem = {
  args: {
    style: {
      height: '250px',
      background: 'whitesmoke',
      borderRadius: '5px',   
  },
    children: mock.map((item) => (
      <div key={item.id}>
        {item.id}: {item.firstName} - {item.lastName}
      </div>
    ))
  },
};