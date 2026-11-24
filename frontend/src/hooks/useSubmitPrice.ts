import { useMutation, useQueryClient } from '@tanstack/react-query';

import { submitPrice } from '../services/submitService';

export function useSubmitPrice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: submitPrice,
    // Avoid submitting the same price again after a network error
    retry: false,
    onSuccess: () => {
      // Refresh item prices after saving
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['priceDrops'] });
    },
  });
}
