import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LoadingState } from '../../../components/common/LoadingState';

describe('LoadingState', () => {
  it('should render children when not loading and data exists', () => {
    render(
      <LoadingState isLoading={false} data={[1, 2, 3]}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should render skeleton when loading', () => {
    const skeleton = <div>Skeleton Loading</div>;

    render(
      <LoadingState isLoading={true} data={null} skeleton={skeleton}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Skeleton Loading')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render error message when error exists', () => {
    const error = new Error('Test error');

    render(
      <LoadingState isLoading={false} data={null} error={error}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });

  it('should render empty state when no data', () => {
    const emptyState = <div>No data available</div>;

    render(
      <LoadingState isLoading={false} data={null} emptyState={emptyState}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('No data available')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should render children when data is empty array but allowEmpty is true', () => {
    render(
      <LoadingState isLoading={false} data={[]} allowEmpty={true}>
        <div>Content</div>
      </LoadingState>
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
