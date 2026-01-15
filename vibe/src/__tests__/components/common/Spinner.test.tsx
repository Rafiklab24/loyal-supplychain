import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Spinner } from '../../../components/common/Spinner';

describe('Spinner', () => {
  it('should render spinner', () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render small spinner', () => {
    const { container } = render(<Spinner size="sm" />);
    const spinner = container.querySelector('.h-4');
    expect(spinner).toBeInTheDocument();
  });

  it('should render medium spinner (default)', () => {
    const { container } = render(<Spinner size="md" />);
    const spinner = container.querySelector('.h-8');
    expect(spinner).toBeInTheDocument();
  });

  it('should render large spinner', () => {
    const { container } = render(<Spinner size="lg" />);
    const spinner = container.querySelector('.h-12');
    expect(spinner).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(<Spinner className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });
});
