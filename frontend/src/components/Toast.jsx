import toast from 'react-hot-toast';
export const notify = {
  success: (m) => toast.success(m),
  error: (m) => toast.error(m),
};
