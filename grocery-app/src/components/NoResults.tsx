import { StateMessage } from './StateMessage';

type Props = {
  query: string;
  onAddPrice: () => void;
  onSearch: (term: string) => void;
};

export function NoResults({ query, onAddPrice, onSearch }: Props) {
  const words = query.trim().split(/\s+/);
  const broader = words.length > 1 ? words[words.length - 1] : null;

  return (
    <StateMessage
      icon="search"
      title="No prices yet"
      message={`Nobody has shared a price for “${query}” near you. Add one and help your neighbors save.`}
      action={{ label: 'Add a Price', onPress: onAddPrice }}
      secondaryAction={
        broader
          ? { label: `Or try a broader search, like “${broader}”`, onPress: () => onSearch(broader) }
          : undefined
      }
    />
  );
}
